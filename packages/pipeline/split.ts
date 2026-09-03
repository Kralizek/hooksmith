import type { TransformContext } from "./context.ts";
import type { Transformer } from "./transformer.ts";

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
