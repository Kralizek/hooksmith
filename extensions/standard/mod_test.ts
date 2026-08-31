import { assertEquals } from "@std/assert";
import type { Config, Context, Event, Logger } from "@hooksmith/core";
import {
  all,
  any,
  data,
  eventType,
  logEvent,
  metadata,
  not,
  sourceId,
  sourceKind,
  subjectId,
  subjectKind,
} from "./mod.ts";

interface PageData {
  title: string;
  published: boolean;
}

const event: Event<PageData> = {
  type: "page.published",
  timestamp: Temporal.Instant.from("2026-08-31T20:00:00Z"),
  source: { kind: "website", id: "example.com" },
  subject: { kind: "page", id: "/hello" },
  metadata: {
    publishedToday: true,
    environment: "production",
    url: "https://example.com/hello",
  },
  data: {
    title: "Hello, Hooksmith",
    published: true,
  },
};

const logger: Logger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
};

const context: Context = { log: logger };

Deno.test("matches event and resource fields", async () => {
  assertEquals(
    await eventType("page.published").evaluate(event, context),
    true,
  );
  assertEquals(await eventType("page.deleted").evaluate(event, context), false);
  assertEquals(await sourceKind("website").evaluate(event, context), true);
  assertEquals(await sourceId("example.com").evaluate(event, context), true);
  assertEquals(await subjectKind("page").evaluate(event, context), true);
  assertEquals(await subjectId("/hello").evaluate(event, context), true);
});

Deno.test("matches event data with sync and async predicates", async () => {
  assertEquals(
    await data<PageData>((value) => value.title.length > 0).evaluate(
      event,
      context,
    ),
    true,
  );
  assertEquals(
    await data<PageData>(async (value) => value.published).evaluate(
      event,
      context,
    ),
    true,
  );
});

Deno.test("matches metadata by strict value and predicate", async () => {
  assertEquals(
    await metadata("environment", "production").evaluate(event, context),
    true,
  );
  assertEquals(
    await metadata("publishedToday", false).evaluate(event, context),
    false,
  );
  assertEquals(
    await metadata(
      "url",
      (value) => typeof value === "string" && value.startsWith("https://"),
    ).evaluate(event, context),
    true,
  );
  assertEquals(
    await metadata("url", async (value) => typeof value === "string").evaluate(
      event,
      context,
    ),
    true,
  );
  assertEquals(
    await metadata("missing", () => true).evaluate(event, context),
    false,
  );
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
  assertEquals(
    await not(eventType("page.deleted")).evaluate(event, context),
    true,
  );
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

Deno.test("typed configs can contextualize data predicates", () => {
  const config = {
    routes: [{
      when: data((value) => value.title.length > 0),
      listeners: [],
    }],
  } satisfies Config<Event<PageData>>;

  assertEquals(config.routes.length, 1);
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
