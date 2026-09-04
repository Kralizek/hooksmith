import type { Event, Listener } from "@hooksmith/core";
import type { LogLevel } from "./types.ts";

export function logEvent<TEvent extends Event = Event>(
  level: LogLevel = "info",
): Listener<TEvent> {
  return {
    name: "log-event",
    run(event, { log }) {
      log[level](`Event ${event.type}`, event);
      return {
        success: true,
        message: `Logged ${event.type}`,
      };
    },
  };
}
