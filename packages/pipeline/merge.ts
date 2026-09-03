import type { TransformContext } from "./context.ts";

/** Polymorphic aggregate wrapper returned by {@link merge}. */
export interface MergeOperator {
  transform<TItems extends readonly unknown[]>(
    input: TItems,
    context: TransformContext,
  ): { items: TItems };
}

/** Wraps a tuple or collection as `{ items: ... }` without losing its type. */
export function merge(): MergeOperator {
  return {
    transform<TItems extends readonly unknown[]>(input: TItems) {
      return { items: input };
    },
  };
}
