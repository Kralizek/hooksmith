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
      run(event, context) {
        context.logger.getLogger("FallbackListener:log-unhandled").warn(
          "No route matched {eventType}",
          { eventType: event.type },
        );
        return { success: true, message: "Unhandled event recorded" };
      },
    },
  ],
} satisfies Config;
