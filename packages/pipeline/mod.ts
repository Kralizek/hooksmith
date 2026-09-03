import type { Context, Event, Listener, ListenerResult } from "@hooksmith/core";

export { caseOf, match, otherwise } from "./match.ts";
export type { MatchCase, MatchOtherwise } from "./match.ts";

export interface TransformContext extends Context {
  readonly originalData: unknown;
}

export interface Transformer<TInput, TOutput> {
  name?: string;
  transform(
    input: TInput,
    context: TransformContext,
  ): TOutput | Promise<TOutput>;
}

export interface PipeOptions {
  name: string;
}

/**
 * Polymorphic aggregate wrapper returned by {@link merge}.
 *
 * The generic transform method preserves the exact tuple or array type produced
 * by the previous pipeline stage without requiring a type argument at the call
 * site.
 */
export interface MergeOperator {
  transform<TItems extends readonly unknown[]>(
    input: TItems,
    context: TransformContext,
  ): { items: TItems };
}

type TransformerOutput<T> = T extends Transformer<infer _TInput, infer TOutput>
  ? TOutput
  : never;

type PipeInput<TItems extends readonly unknown[]> = TItems extends readonly [
  Transformer<infer TInput, infer _TOutput>,
  ...readonly unknown[],
] ? TInput
  : TItems extends readonly [Listener<Event<infer TData>>] ? TData
  : never;

type ApplyStep<TInput, TStep> = TStep extends MergeOperator
  ? TInput extends readonly unknown[] ? { items: TInput } : never
  : TStep extends Transformer<infer TStepInput, infer TOutput>
    ? TInput extends TStepInput ? TOutput : never
  : never;

type IsValidPipeTail<TInput, TItems extends readonly unknown[]> = TItems extends
  readonly [infer TNext, ...infer TRest]
  ? TNext extends Listener<Event<infer TListenerData>>
    ? TRest extends readonly [] ? TInput extends TListenerData ? true : false
    : false
  : [ApplyStep<TInput, TNext>] extends [never] ? false
  : IsValidPipeTail<ApplyStep<TInput, TNext>, TRest>
  : false;

type IsValidPipe<TItems extends readonly unknown[]> = TItems extends readonly [
  Transformer<infer _TInput, infer TOutput>,
  ...infer TRest,
] ? IsValidPipeTail<TOutput, TRest>
  : TItems extends readonly [Listener<Event<unknown>>] ? true
  : false;

type ValidPipe<TItems extends readonly unknown[]> = IsValidPipe<TItems> extends
  true ? TItems
  : never;

type ParallelInput<TTransformers extends readonly unknown[]> =
  TTransformers extends readonly [
    Transformer<infer TInput, infer _TOutput>,
    ...readonly unknown[],
  ] ? TInput
    : never;

type ParallelOutputs<TTransformers extends readonly unknown[]> = {
  readonly [K in keyof TTransformers]: TransformerOutput<TTransformers[K]>;
};

type IsValidParallel<
  TInput,
  TTransformers extends readonly unknown[],
> = TTransformers extends readonly [
  Transformer<infer TCurrentInput, infer _TOutput>,
  ...infer TRest,
] ? TInput extends TCurrentInput ? IsValidParallel<TInput, TRest> : false
  : true;

type ValidParallel<TTransformers extends readonly unknown[]> =
  TTransformers extends readonly [
    Transformer<infer TInput, infer _TOutput>,
    ...readonly unknown[],
  ] ? IsValidParallel<TInput, TTransformers> extends true ? TTransformers
    : never
    : never;

/**
 * Composes zero or more data transformations with a final Hooksmith listener.
 *
 * Every transformation receives the output of the previous stage. The returned
 * listener accepts an event carrying the input data expected by the first
 * transformation and preserves the original event envelope for the final
 * listener.
 */
export function pipe<const TItems extends readonly unknown[]>(
  ...items: TItems & ValidPipe<TItems>
): Listener<Event<PipeInput<TItems>>>;
export function pipe<const TItems extends readonly unknown[]>(
  options: PipeOptions,
  ...items: TItems & ValidPipe<TItems>
): Listener<Event<PipeInput<TItems>>>;
export function pipe(
  ...args: readonly unknown[]
): Listener<Event<unknown>> {
  const options = isPipeOptions(args[0]) ? args[0] : undefined;
  const items = options === undefined ? args : args.slice(1);

  if (items.length === 0) {
    throw new Error("pipe requires a final listener.");
  }

  const listener = items.at(-1) as Listener<Event<unknown>>;
  const transformations = items.slice(0, -1) as readonly (
    | Transformer<unknown, unknown>
    | MergeOperator
  )[];
  const name = options?.name ?? `pipe:${listener.name ?? "listener"}`;

  return {
    name,
    async run(event, context): Promise<ListenerResult> {
      const transformContext: TransformContext = {
        ...context,
        originalData: event.data,
      };
      let current: unknown = event.data;

      for (let index = 0; index < transformations.length; index++) {
        const transformation = transformations[index];

        try {
          current = await transformation.transform(
            current as never,
            transformContext,
          );
        } catch (error) {
          const ordinal = index + 1;
          const transformationName = "name" in transformation
            ? transformation.name
            : undefined;
          const identity = transformationName === undefined
            ? `Transformation #${ordinal}`
            : `Transformation "${transformationName}"`;
          const message = errorMessage(error);

          return {
            success: false,
            message: `${identity} failed: ${message}`,
            data: {
              stage: "transform",
              index: ordinal,
              ...(transformationName === undefined
                ? {}
                : { name: transformationName }),
              error: message,
            },
          };
        }
      }

      return await listener.run({ ...event, data: current }, context);
    },
  };
}

/** Creates an inline transformation from an arbitrary projection. */
export function project<TInput, TOutput>(
  projection: (
    input: TInput,
    context: TransformContext,
  ) => TOutput | Promise<TOutput>,
  name?: string,
): Transformer<TInput, TOutput> {
  return { name, transform: projection };
}

/**
 * Runs transformations concurrently against the same input and returns their
 * results as a typed tuple in declaration order.
 */
export function parallel<const TTransformers extends readonly unknown[]>(
  ...transformers: TTransformers & ValidParallel<TTransformers>
): Transformer<
  ParallelInput<TTransformers>,
  ParallelOutputs<TTransformers>
> {
  if (transformers.length === 0) {
    throw new Error("parallel requires at least one transformer.");
  }

  return {
    async transform(input, context) {
      const results = transformers.map(async (transformer, index) => {
        const current = transformer as Transformer<
          ParallelInput<TTransformers>,
          unknown
        >;

        try {
          return await current.transform(input, context);
        } catch (error) {
          const identity = current.name === undefined
            ? `Parallel transformation #${index + 1}`
            : `Parallel transformation "${current.name}"`;

          throw new Error(`${identity} failed: ${errorMessage(error)}`, {
            cause: error,
          });
        }
      });

      return await Promise.all(results) as ParallelOutputs<TTransformers>;
    },
  };
}

/** Conditionally applies a same-type transformation. */
export function when<T>(
  condition: (
    input: T,
    context: TransformContext,
  ) => boolean | Promise<boolean>,
  transformer: Transformer<T, T>,
): Transformer<T, T> {
  return {
    name: transformer.name,
    async transform(input, context) {
      return await condition(input, context)
        ? await transformer.transform(input, context)
        : input;
    },
  };
}

/** Projects one value into a homogeneous collection. */
export function split<TInput, TItem>(
  selector: (
    input: TInput,
    context: TransformContext,
  ) => readonly TItem[] | Promise<readonly TItem[]>,
  name?: string,
): Transformer<TInput, readonly TItem[]> {
  return { name, transform: selector };
}

/** Applies one operation concurrently to every item in a collection. */
export function each<TInput, TOutput>(
  transformer: Transformer<TInput, TOutput>,
): Transformer<readonly TInput[], readonly TOutput[]>;
export function each<TInput>(
  listener: Listener<Event<TInput>>,
): Listener<Event<readonly TInput[]>>;
export function each<TInput, TOutput>(
  operation: Transformer<TInput, TOutput> | Listener<Event<TInput>>,
):
  | Transformer<readonly TInput[], readonly TOutput[]>
  | Listener<Event<readonly TInput[]>> {
  if (!("transform" in operation) && "run" in operation) {
    const listener = operation;

    return {
      name: listener.name,
      async run(event, context) {
        const results = await Promise.all(
          event.data.map((item) =>
            listener.run({ ...event, data: item }, context)
          ),
        );

        return {
          success: results.every((result) => result.success),
          data: { results },
        };
      },
    };
  }

  const transformer = operation as Transformer<TInput, TOutput>;

  return {
    name: transformer.name,
    async transform(input, context) {
      return await Promise.all(input.map(async (item, index) => {
        try {
          return await transformer.transform(item, context);
        } catch (error) {
          const identity = transformer.name === undefined
            ? `Item transformation #${index + 1}`
            : `Item transformation "${transformer.name}" at item #${index + 1}`;

          throw new Error(`${identity} failed: ${errorMessage(error)}`, {
            cause: error,
          });
        }
      }));
    },
  };
}

/** Wraps a tuple or collection as `{ items: ... }` without losing its type. */
export function merge(): MergeOperator {
  return {
    transform<TItems extends readonly unknown[]>(input: TItems) {
      return { items: input };
    },
  };
}

function isPipeOptions(value: unknown): value is PipeOptions {
  return typeof value === "object" && value !== null &&
    "name" in value && typeof value.name === "string" &&
    !("transform" in value) && !("run" in value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
