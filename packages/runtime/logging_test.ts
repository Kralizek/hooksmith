import { assertEquals } from "@std/assert";
import {
  createLoggerFactory,
  type LogRecord,
  renderLogTemplate,
} from "./mod.ts";

Deno.test("logger factory binds the source and renders structured properties", () => {
  const records: LogRecord[] = [];
  const factory = createLoggerFactory({
    minimumLevel: "trace",
    write: (record) => records.push(record),
  });

  factory.getLogger("HttpListener:slack").debug(
    "Sending {method} request to {url}",
    {
      method: "POST",
      url: "https://slack.com/api/chat.postMessage",
      attempt: 1,
    },
  );

  assertEquals(records, [{
    level: "debug",
    source: "HttpListener:slack",
    template: "Sending {method} request to {url}",
    message: "Sending POST request to https://slack.com/api/chat.postMessage",
    properties: {
      method: "POST",
      url: "https://slack.com/api/chat.postMessage",
      attempt: 1,
    },
    error: undefined,
  }]);
});

Deno.test("logger factory filters entries below the minimum level", () => {
  const records: LogRecord[] = [];
  const log = createLoggerFactory({
    minimumLevel: "debug",
    write: (record) => records.push(record),
  }).getLogger("Runtime");

  log.trace("trace");
  log.debug("debug");
  log.info("info");

  assertEquals(records.map((record) => record.level), ["debug", "info"]);
});

Deno.test("none minimum level disables all logging", () => {
  const records: LogRecord[] = [];
  const log = createLoggerFactory({
    minimumLevel: "none",
    write: (record) => records.push(record),
  }).getLogger("Runtime");

  log.trace("trace");
  log.debug("debug");
  log.info("info");
  log.warn("warn");
  log.error("error");

  assertEquals(records, []);
});

Deno.test("logger factory preserves the dedicated error value", () => {
  const records: LogRecord[] = [];
  const error = new Error("boom");
  const log = createLoggerFactory({
    write: (record) => records.push(record),
  }).getLogger("Runtime");

  log.error("Processing failed", undefined, error);

  assertEquals(records.length, 1);
  assertEquals(records[0].error, error);
});

Deno.test("renderLogTemplate leaves missing placeholders visible", () => {
  assertEquals(
    renderLogTemplate("Listener {listener} completed for {route}", {
      listener: "slack",
    }),
    "Listener slack completed for {route}",
  );
});

Deno.test("renderLogTemplate renders structured placeholder values", () => {
  assertEquals(
    renderLogTemplate("Payload {payload}", { payload: { value: 42 } }),
    'Payload {"value":42}',
  );
});
