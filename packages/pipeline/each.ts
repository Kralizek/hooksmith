import type { Event, Listener } from "@hooksmith/core";
import { errorMessage } from "./errors.ts";
import type { Transformer } from "./transformer.ts";

/** Applies one operation concurrently to every item in a collection. */
export function each<TInput, TOutput>(
  transformer: Transformer<TInput, TOutput>,
): Transformer<readonly TInput[], readonly TOutput[]>;
export function each<TInput>(
  listener: Listener<Event<TInput>>,
): Listener<Event<readonly TInput[]>>;
export function each<TInput, TOutput>(
  operation: Transformer<TInput, TOutput> | Listener<Event<TInput>>,
):
  | Transformer<readonly TInput[], readonly TOutput[]>
  | Listener<Event<readonly TInput[]>> {
  if (
    typeof operation === "object" && operation !== null &&
    "run" in operation && typeof operation.run === "function"
  ) {
    const listener = operation as Listener<Event<TInput>>;

    return {
      name: listener.name,
      async run(event, context) {
        const results = await Promise.all(
          event.data.map((item) =>
            listener.run({ ...event, data: item }, context)
          ),
        );

        return {
          success: results.every((result) => result.success),
          data: { results },
        };
      },
    };
  }

  const transformer = operation as Transformer<TInput, TOutput>;

  return {
    name: transformer.name,
    async transform(input, context) {
      return await Promise.all(input.map(async (item, index) => {
        try {
          return await transformer.transform(item, context);
        } catch (error) {
          const identity = transformer.name === undefined
            ? `Item transformation #${index + 1}`
            : `Item transformation "${transformer.name}" at item #${index + 1}`;

          throw new Error(`${identity} failed: ${errorMessage(error)}`, {
            cause: error,
          });
        }
      }));
    },
  };
}
