import type { TransformContext, Transformer } from "./mod.ts";

type MatchNoInfer<T> = [T][T extends unknown ? 0 : never];

export interface MatchCase<TInput, TOutput> {
  readonly kind: "case";
  readonly predicate: (
    input: TInput,
    context: TransformContext,
  ) => boolean | Promise<boolean>;
  readonly transformer: Transformer<TInput, TOutput>;
}

export interface MatchOtherwise<TInput, TOutput> {
  readonly kind: "otherwise";
  readonly transformer: Transformer<TInput, TOutput>;
}

/** Defines one ordered branch for {@link match}. */
export function caseOf<TInput, TOutput>(
  predicate: (
    input: TInput,
    context: TransformContext,
  ) => boolean | Promise<boolean>,
  transformer: Transformer<TInput, TOutput>,
): MatchCase<TInput, TOutput> {
  return { kind: "case", predicate, transformer };
}

/** Defines the required fallback branch for {@link match}. */
export function otherwise<TInput, TOutput>(
  transformer: Transformer<TInput, TOutput>,
): MatchOtherwise<TInput, TOutput> {
  return { kind: "otherwise", transformer };
}

/**
 * Selects the first matching branch and applies exactly one transformer.
 *
 * All cases receive the same input type and must produce the same output type.
 * The final `otherwise(...)` branch guarantees that the match is exhaustive.
 */
export function match<TInput, TOutput>(
  first: MatchCase<TInput, TOutput>,
  ...branches: readonly [
    ...MatchCase<MatchNoInfer<TInput>, MatchNoInfer<TOutput>>[],
    MatchOtherwise<MatchNoInfer<TInput>, MatchNoInfer<TOutput>>,
  ]
): Transformer<TInput, TOutput> {
  const fallback = branches.at(-1);
  const cases = [first, ...branches.slice(0, -1)];

  return {
    async transform(input, context) {
      if (fallback?.kind !== "otherwise") {
        throw new Error("match requires a final otherwise branch.");
      }

      for (const branch of cases) {
        if (
          branch.kind === "case" &&
          await branch.predicate(input, context)
        ) {
          return await branch.transformer.transform(input, context);
        }
      }

      return await fallback.transformer.transform(input, context);
    },
  };
}
