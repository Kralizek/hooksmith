import { assertEquals, assertRejects } from "@std/assert";
import {
  setTelemetry,
  type Telemetry,
  type TelemetryAttributes,
  type TelemetrySpan,
} from "@hooksmith/core";
import { createRuntime, nullLoggerFactory } from "./mod.ts";

function event() {
  return {
    type: "page.published",
    timestamp: Temporal.Instant.from("2026-09-05T16:00:00Z"),
    source: { kind: "test", id: "source" },
    data: {},
  };
}

function captureSpanEvents() {
  const events: Array<{
    name: string;
    attributes?: TelemetryAttributes;
  }> = [];

  const span: TelemetrySpan = {
    setAttribute() {},
    setAttributes() {},
    addEvent(name, attributes) {
      events.push({ name, attributes });
    },
    recordException() {},
    setError() {},
    end() {},
  };

  const telemetry: Telemetry = {
    async startActiveSpan(_scope, _name, _attributes, run) {
      return await run(span);
    },
    counter() {
      return { add() {} };
    },
    histogram() {
      return { record() {} };
    },
  };

  return { events, telemetry };
}

Deno.test("emits a failed event when an enricher throws", async () => {
  const { events, telemetry } = captureSpanEvents();
  const restoreTelemetry = setTelemetry(telemetry);

  try {
    const runtime = createRuntime({
      enrichers: [{
        name: "tenant",
        enrich() {
          throw new Error("unavailable");
        },
      }],
      routes: [],
    }, { logger: nullLoggerFactory });

    await assertRejects(
      () => runtime.process(event()),
      Error,
      "Event enricher tenant failed: unavailable",
    );

    assertEquals(events, [{
      name: "hooksmith.enricher.failed",
      attributes: { "hooksmith.enricher": "tenant" },
    }]);
  } finally {
    restoreTelemetry();
  }
});

Deno.test("emits a failed event when a condition throws", async () => {
  const { events, telemetry } = captureSpanEvents();
  const restoreTelemetry = setTelemetry(telemetry);

  try {
    const runtime = createRuntime({
      routes: [{
        name: "publication",
        when: {
          name: "is-published",
          evaluate() {
            throw new Error("routing unavailable");
          },
        },
        listeners: [],
      }],
    }, { logger: nullLoggerFactory });

    await assertRejects(
      () => runtime.process(event()),
      Error,
      "Condition is-published failed: routing unavailable",
    );

    assertEquals(events, [{
      name: "hooksmith.condition.failed",
      attributes: {
        "hooksmith.condition": "is-published",
        "hooksmith.route": "publication",
      },
    }]);
  } finally {
    restoreTelemetry();
  }
});
