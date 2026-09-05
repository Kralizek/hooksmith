import { assertEquals } from "@std/assert";
import type { Config, Context, Event } from "@hooksmith/core";
import { createRuntime, nullLoggerFactory } from "./mod.ts";

const context: Context = {
  logger: nullLoggerFactory,
};

const event: Event = {
  type: "page.published",
  timestamp: Temporal.Instant.from("2026-09-02T10:00:00Z"),
  source: { kind: "website", id: "example.com" },
  data: {},
};

Deno.test("reports matched routing outcome", async () => {
  const config: Config = {
    routes: [{
      when: { evaluate: () => true },
      listeners: [{ run: () => ({ success: true }) }],
    }],
  };

  const report = await createRuntime(config, context).process(event);

  assertEquals(report.outcome, "matched");
});

Deno.test("reports fallback routing outcome", async () => {
  const config: Config = {
    routes: [{
      when: { evaluate: () => false },
      listeners: [],
    }],
    fallback: [{ run: () => ({ success: true }) }],
  };

  const report = await createRuntime(config, context).process(event);

  assertEquals(report.outcome, "fallback");
});

Deno.test("reports unmatched routing outcome without a fallback", async () => {
  const config: Config = {
    routes: [{
      when: { evaluate: () => false },
      listeners: [],
    }],
  };

  const report = await createRuntime(config, context).process(event);

  assertEquals(report.outcome, "unmatched");
  assertEquals(report.results, []);
  assertEquals(report.success, true);
});
