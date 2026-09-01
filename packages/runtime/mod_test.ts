import { assertEquals, assertRejects, assertThrows } from "@std/assert";
import type { Config, Context, Event, Listener, Logger } from "@hooksmith/core";
import { createRuntime, hydrateEvent } from "./mod.ts";

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

Deno.test("validates config when creating a runtime", () => {
  assertThrows(
    () => createRuntime({ routes: "invalid" } as unknown as Config, context),
    Error,
    "Config.routes must be an array.",
  );
});

Deno.test("processes multiple events with one runtime", async () => {
  const calls: string[] = [];
  const config: Config = {
    routes: [{
      listeners: [{
        run(currentEvent, currentContext) {
          assertEquals(currentContext, context);
          calls.push(currentEvent.subject?.id ?? "");
          return { success: true };
        },
      }],
    }],
  };

  const runtime = createRuntime(config, context);
  const first = event();
  const second = {
    ...event(),
    subject: { kind: "page", id: "/second" },
  };

  const firstReport = await runtime.process(first);
  const secondReport = await runtime.process(second);

  assertEquals(calls, ["/hello", "/second"]);
  assertEquals(firstReport.success, true);
  assertEquals(secondReport.success, true);
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

  const report = await createRuntime(config, context).process(event());

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

  const report = await createRuntime(config, context).process(event());

  assertEquals(calls, ["fallback"]);
  assertEquals(report.results[0].route, "fallback");
});

Deno.test("condition errors identify the condition and abort execution", async () => {
  let listenerRan = false;
  const cause = new Error("routing failed");
  const config: Config = {
    routes: [
      {
        name: "publication",
        when: {
          name: "is-published",
          evaluate() {
            throw cause;
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

  const runtime = createRuntime(config, context);
  const error = await assertRejects(
    () => runtime.process(event()),
    Error,
    "Condition is-published failed: routing failed",
  );
  assertEquals(error.cause, cause);
  assertEquals(listenerRan, false);
});

Deno.test("condition errors use positional identity when unnamed", async () => {
  const cause = new Error("routing failed");
  const config: Config = {
    routes: [{
      when: {
        evaluate() {
          throw cause;
        },
      },
      listeners: [],
    }],
  };

  const runtime = createRuntime(config, context);
  const error = await assertRejects(
    () => runtime.process(event()),
    Error,
    "Condition route-1/condition failed: routing failed",
  );
  assertEquals(error.cause, cause);
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

  const report = await createRuntime(config, context).process(event());

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

  const report = await createRuntime(config, context).plan(event());

  assertEquals(listenerRan, false);
  assertEquals(report.mode, "plan");
  assertEquals(report.results, [{
    route: "publication",
    listener: "publish",
    status: "planned",
  }]);
  assertEquals(report.success, true);
});
