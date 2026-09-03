import type { TransformContext } from "./context.ts";

/** Typed transformation stage that converts one pipeline value into another. */
export interface Transformer<TInput, TOutput> {
  name?: string;
  transform(
    input: TInput,
    context: TransformContext,
  ): TOutput | Promise<TOutput>;
}
