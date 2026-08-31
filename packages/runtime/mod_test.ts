import { assertEquals, assertRejects } from "@std/assert";
import type { Config, Context, Event, Listener, Logger } from "@hooksmith/core";
import { hydrateEvent, runEvent } from "./mod.ts";

const logger: Logger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
};

const context: Context = { log: logger };

function event(): Event {
  return {
    type: "page.published",
    timestamp: Temporal.Instant.from("2026-08-31T20:00:00Z"),
    source: { kind: "website", id: "example.com" },
    subject: { kind: "page", id: "/hello" },
    metadata: { url: "https://example.com/hello" },
    data: { title: "Hello" },
  };
}

Deno.test("hydrates an event document", () => {
  const value = hydrateEvent({
    type: "page.published",
    timestamp: "2026-08-31T20:00:00Z",
    source: { kind: "website", id: "example.com" },
    data: {},
  });

  assertEquals(value.timestamp.toString(), "2026-08-31T20:00:00Z");
});

Deno.test("runs all matching routes and listeners in config order", async () => {
  const calls: string[] = [];
  const listener = (name: string): Listener => ({
    name,
    run() {
      calls.push(name);
      return { success: true };
    },
  });

  const config: Config = {
    routes: [
      {
        name: "first",
        when: { evaluate: () => true },
        listeners: [listener("a"), listener("b")],
      },
      {
        name: "second",
        when: { evaluate: () => true },
        listeners: [listener("c")],
      },
    ],
  };

  const report = await runEvent(event(), config, context);

  assertEquals(calls, ["a", "b", "c"]);
  assertEquals(report.results.map((result) => result.route), [
    "first",
    "first",
    "second",
  ]);
  assertEquals(report.success, true);
});

Deno.test("runs fallback only when no route matches", async () => {
  const calls: string[] = [];
  const config: Config = {
    routes: [{
      when: { evaluate: () => false },
      listeners: [{ run: () => ({ success: true }) }],
    }],
    fallback: [{
      name: "fallback-listener",
      run() {
        calls.push("fallback");
        return { success: true };
      },
    }],
  };

  const report = await runEvent(event(), config, context);

  assertEquals(calls, ["fallback"]);
  assertEquals(report.results[0].route, "fallback");
});

Deno.test("condition errors abort execution", async () => {
  let listenerRan = false;
  const config: Config = {
    routes: [
      {
        when: {
          evaluate() {
            throw new Error("routing failed");
          },
        },
        listeners: [],
      },
      {
        listeners: [{
          run() {
            listenerRan = true;
            return { success: true };
          },
        }],
      },
    ],
  };

  await assertRejects(
    () => runEvent(event(), config, context),
    Error,
    "routing failed",
  );
  assertEquals(listenerRan, false);
});

Deno.test("listener failures do not prevent later listeners", async () => {
  const calls: string[] = [];
  const config: Config = {
    routes: [{
      listeners: [
        {
          name: "throws",
          run() {
            calls.push("throws");
            throw new Error("boom");
          },
        },
        {
          name: "reports-failure",
          run() {
            calls.push("reports-failure");
            return { success: false, message: "nope" };
          },
        },
        {
          name: "succeeds",
          run() {
            calls.push("succeeds");
            return { success: true };
          },
        },
      ],
    }],
  };

  const report = await runEvent(event(), config, context);

  assertEquals(calls, ["throws", "reports-failure", "succeeds"]);
  assertEquals(report.results.map((result) => result.status), [
    "failure",
    "failure",
    "success",
  ]);
  assertEquals(report.success, false);
});

Deno.test("plan evaluates routing but does not invoke listeners", async () => {
  let listenerRan = false;
  const config: Config = {
    routes: [{
      name: "publication",
      when: { name: "matches", evaluate: () => true },
      listeners: [{
        name: "publish",
        run() {
          listenerRan = true;
          return { success: true };
        },
      }],
    }],
  };

  const report = await runEvent(event(), config, context, { plan: true });

  assertEquals(listenerRan, false);
  assertEquals(report.mode, "plan");
  assertEquals(report.results, [{
    route: "publication",
    listener: "publish",
    status: "planned",
  }]);
  assertEquals(report.success, true);
});
