import type { Config } from "@hooksmith/core";
import { any, eventType, logEvent, not, sourceKind } from "@hooksmith/standard";

export default {
  routes: [
    {
      name: "content-changes",
      when: any(
        eventType("page.published"),
        eventType("page.updated"),
      ),
      listeners: [logEvent("debug")],
    },
    {
      name: "non-scheduled-web-events",
      when: not(sourceKind("scheduler")),
      listeners: [logEvent()],
    },
  ],
  fallback: [logEvent("warn")],
} satisfies Config;
