import type { Event, Listener } from "@hooksmith/core";
import type { LogLevel } from "./types.ts";

export function logEvent<TEvent extends Event = Event>(
  level: LogLevel = "info",
): Listener<TEvent> {
  const name = "log-event";

  return {
    name,
    run(event, context) {
      const log = context.logger.getLogger(`LogListener:${name}`);
      log[level]("Event {eventType}", {
        eventType: event.type,
        event,
      });
      return {
        success: true,
        message: `Logged ${event.type}`,
      };
    },
  };
}
