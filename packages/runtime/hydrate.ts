import type { Event, EventDocument } from "@hooksmith/core";
import { assertEventDocument } from "./validation.ts";

export function hydrateEvent<TData>(
  document: EventDocument<TData>,
): Event<TData> {
  assertEventDocument(document);

  let timestamp: Temporal.Instant;
  try {
    timestamp = Temporal.Instant.from(document.timestamp);
  } catch (error) {
    throw new Error(
      "Event timestamp must be a valid Temporal.Instant string.",
      {
        cause: error,
      },
    );
  }

  return {
    ...document,
    timestamp,
  };
}
