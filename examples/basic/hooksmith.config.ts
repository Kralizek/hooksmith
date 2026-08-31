import type { Config } from "@hooksmith/core";
import {
  all,
  eventType,
  logEvent,
  sourceKind,
  subjectKind,
} from "@hooksmith/standard";

export default {
  routes: [
    {
      name: "published-pages",
      when: all(
        eventType("page.published"),
        sourceKind("website"),
        subjectKind("page"),
      ),
      listeners: [logEvent()],
    },
  ],
  fallback: [
    {
      name: "log-unhandled",
      run(event, { log }) {
        log.warn(`No route matched ${event.type}`);
        return { success: true, message: "Unhandled event recorded" };
      },
    },
  ],
} satisfies Config;
