import type { TransformContext } from "./context.ts";

export interface Transformer<TInput, TOutput> {
  name?: string;
  transform(
    input: TInput,
    context: TransformContext,
  ): TOutput | Promise<TOutput>;
}
