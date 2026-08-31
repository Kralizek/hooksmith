import type { Config } from "@hooksmith/core";
import {
  all,
  any,
  data,
  eventType,
  logEvent,
  metadata,
  not,
  sourceKind,
} from "@hooksmith/standard";

interface PageData {
  title: string;
}

export default {
  routes: [
    {
      name: "content-changes",
      when: all(
        any(
          eventType("page.published"),
          eventType("page.updated"),
        ),
        data<PageData>((value) => value.title.length > 0),
        metadata("environment", "production"),
      ),
      listeners: [logEvent("debug")],
    },
    {
      name: "secure-web-events",
      when: all(
        not(sourceKind("scheduler")),
        metadata(
          "url",
          (value) => typeof value === "string" && value.startsWith("https://"),
        ),
      ),
      listeners: [logEvent()],
    },
  ],
  fallback: [logEvent("warn")],
} satisfies Config;
