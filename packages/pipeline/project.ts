import type { TransformContext } from "./context.ts";
import type { Transformer } from "./transformer.ts";

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
