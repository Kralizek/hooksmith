import type { Context, Event, Listener } from "@hooksmith/core";
import type { TransformContext, Transformer } from "./mod.ts";

const eventContext = Symbol("hooksmith.pipeline.event");

type PipelineTransformContext = TransformContext & {
  readonly [eventContext]: Event<unknown>;
};

export type TapEffect<T> = (
  input: T,
  context: TransformContext,
) => void | Promise<void>;

/**
 * Creates a pass-through transformer that performs a side effect without
 * changing the value flowing through the pipeline.
 */
export function tap<T>(
  effect: TapEffect<T>,
  name?: string,
): Transformer<T, T>;
/**
 * Creates a pass-through transformer from a Hooksmith listener.
 *
 * The listener receives the original event envelope with the current pipeline
 * value as `data`. Its result is not forwarded downstream, but an unsuccessful
 * result still fails the transformation.
 */
export function tap<T>(listener: Listener<Event<T>>): Transformer<T, T>;
export function tap<T>(
  effect: TapEffect<T> | Listener<Event<T>>,
  name?: string,
): Transformer<T, T> {
  if (typeof effect === "object" && effect !== null && "run" in effect) {
    const listener = effect;

    return {
      name: listener.name,
      async transform(input, context) {
        const event = (context as Partial<PipelineTransformContext>)[eventContext];

        if (event === undefined) {
          throw new Error("tap(listener) can only run inside a pipeline.");
        }

        const result = await listener.run({ ...event, data: input }, context);

        if (!result.success) {
          throw new Error(
            result.message ??
              `Listener ${listener.name === undefined ? "tap" : `\"${listener.name}\"`} failed.`,
          );
        }

        return input;
      },
    };
  }

  return {
    name,
    async transform(input, context) {
      await effect(input, context);
      return input;
    },
  };
}

/** @internal */
export function createTransformContext(
  context: Context,
  event: Event<unknown>,
): TransformContext {
  return {
    ...context,
    originalData: event.data,
    [eventContext]: event,
  } as PipelineTransformContext;
}
