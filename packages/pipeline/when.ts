import type { TransformContext } from "./context.ts";
import type { Transformer } from "./transformer.ts";

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
