import type { Event, Listener } from "@hooksmith/core";
import { getTransformEvent, type TransformContext } from "./context.ts";
import type { Transformer } from "./transformer.ts";

/** Side-effect callback used by {@link tap} without changing the pipeline value. */
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
  if (
    typeof effect === "object" && effect !== null &&
    "run" in effect && typeof effect.run === "function"
  ) {
    const listener = effect as Listener<Event<T>>;

    return {
      name: listener.name,
      async transform(input, context) {
        const event = getTransformEvent(context);

        if (event === undefined) {
          throw new Error("tap(listener) can only run inside a pipeline.");
        }

        const result = await listener.run({ ...event, data: input }, context);

        if (!result.success) {
          throw new Error(result.message ?? "Tapped listener failed.");
        }

        return input;
      },
    };
  }

  const callback = effect as TapEffect<T>;

  return {
    name,
    async transform(input, context) {
      await callback(input, context);
      return input;
    },
  };
}
