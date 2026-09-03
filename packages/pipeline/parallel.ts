import { errorMessage } from "./errors.ts";
import type { Transformer } from "./transformer.ts";

type TransformerOutput<T> = T extends Transformer<infer _TInput, infer TOutput>
  ? TOutput
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

/** Runs transformations concurrently against the same input. */
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
