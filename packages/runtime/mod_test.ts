import { assertEquals, assertRejects, assertThrows } from "@std/assert";
import type { Config, Context, Event, Listener } from "@hooksmith/core";
import { createRuntime, hydrateEvent, nullLoggerFactory } from "./mod.ts";

const context: Context = {
  logger: nullLoggerFactory,
};

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

Deno.test("runs event enrichers in order before route conditions", async () => {
  const calls: string[] = [];
  const config: Config = {
    enrichers: [
      {
        name: "trace",
        enrich(currentEvent) {
          calls.push("trace");
          assertEquals(currentEvent.metadata?.traceId, undefined);
          return { metadata: { traceId: "trace-1", shared: "first" } };
        },
      },
      {
        name: "tenant",
        enrich(currentEvent) {
          calls.push("tenant");
          assertEquals(currentEvent.metadata?.traceId, "trace-1");
          return { metadata: { tenantId: "tenant-1", shared: "second" } };
        },
      },
    ],
    routes: [{
      when: {
        evaluate(currentEvent) {
          calls.push("condition");
          return currentEvent.metadata?.tenantId === "tenant-1";
        },
      },
      listeners: [{
        run(currentEvent) {
          calls.push("listener");
          assertEquals(currentEvent.metadata, {
            url: "https://example.com/hello",
            traceId: "trace-1",
            tenantId: "tenant-1",
            shared: "second",
          });
          return { success: true };
        },
      }],
    }],
  };

  const report = await createRuntime(config, context).process(event());

  assertEquals(calls, ["trace", "tenant", "condition", "listener"]);
  assertEquals(report.event.metadata, {
    url: "https://example.com/hello",
    traceId: "trace-1",
    tenantId: "tenant-1",
    shared: "second",
  });
});

Deno.test("plan applies event enrichment before routing", async () => {
  let conditionMatched = false;
  const config: Config = {
    enrichers: [{
      enrich: () => ({ metadata: { planned: true } }),
    }],
    routes: [{
      when: {
        evaluate(currentEvent) {
          conditionMatched = currentEvent.metadata?.planned === true;
          return conditionMatched;
        },
      },
      listeners: [{ run: () => ({ success: true }) }],
    }],
  };

  const report = await createRuntime(config, context).plan(event());

  assertEquals(conditionMatched, true);
  assertEquals(report.outcome, "matched");
  assertEquals(report.event.metadata?.planned, true);
});

Deno.test("event enricher errors identify the enricher and abort routing", async () => {
  let conditionRan = false;
  const cause = new Error("telemetry unavailable");
  const config: Config = {
    enrichers: [{
      name: "otel",
      enrich() {
        throw cause;
      },
    }],
    routes: [{
      when: {
        evaluate() {
          conditionRan = true;
          return true;
        },
      },
      listeners: [],
    }],
  };

  const error = await assertRejects(
    () => createRuntime(config, context).process(event()),
    Error,
    "Event enricher otel failed: telemetry unavailable",
  );

  assertEquals(error.cause, cause);
  assertEquals(conditionRan, false);
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
