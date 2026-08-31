import { assertEquals } from "@std/assert";
import type { Context, Event, Logger } from "@hooksmith/core";
import {
  all,
  any,
  eventType,
  logEvent,
  not,
  sourceId,
  sourceKind,
  subjectId,
  subjectKind,
} from "./mod.ts";

const event: Event = {
  type: "page.published",
  timestamp: Temporal.Instant.from("2026-08-31T20:00:00Z"),
  source: { kind: "website", id: "example.com" },
  subject: { kind: "page", id: "/hello" },
  data: {},
};

const logger: Logger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
};

const context: Context = { log: logger };

Deno.test("matches event and resource fields", async () => {
  assertEquals(await eventType("page.published").evaluate(event, context), true);
  assertEquals(await eventType("page.deleted").evaluate(event, context), false);
  assertEquals(await sourceKind("website").evaluate(event, context), true);
  assertEquals(await sourceId("example.com").evaluate(event, context), true);
  assertEquals(await subjectKind("page").evaluate(event, context), true);
  assertEquals(await subjectId("/hello").evaluate(event, context), true);
});

Deno.test("composes conditions", async () => {
  assertEquals(
    await all(eventType("page.published"), sourceKind("website")).evaluate(
      event,
      context,
    ),
    true,
  );
  assertEquals(
    await any(eventType("page.deleted"), sourceKind("website")).evaluate(
      event,
      context,
    ),
    true,
  );
  assertEquals(await not(eventType("page.deleted")).evaluate(event, context), true);
});

Deno.test("condition composition short-circuits", async () => {
  let evaluated = false;
  const second = {
    evaluate() {
      evaluated = true;
      return true;
    },
  };

  await all(eventType("page.deleted"), second).evaluate(event, context);
  assertEquals(evaluated, false);

  await any(eventType("page.published"), second).evaluate(event, context);
  assertEquals(evaluated, false);
});

Deno.test("logs events at the requested level", async () => {
  const calls: unknown[][] = [];
  const testLogger: Logger = {
    debug: (...args) => calls.push(["debug", ...args]),
    info: (...args) => calls.push(["info", ...args]),
    warn: (...args) => calls.push(["warn", ...args]),
    error: (...args) => calls.push(["error", ...args]),
  };

  const result = await logEvent("warn").run(event, { log: testLogger });

  assertEquals(calls.length, 1);
  assertEquals(calls[0][0], "warn");
  assertEquals(calls[0][1], "Event page.published");
  assertEquals(calls[0][2], event);
  assertEquals(result, {
    success: true,
    message: "Logged page.published",
  });
});
