# @hooksmith/runtime

Runtime engine for Hooksmith event hydration, validation, routing, planning,
listener execution, fallback handling, run reports, and the default logging
implementation.

Create a runtime once for the lifetime of a host and process events through it:

```ts
const runtime = createRuntime(config, context);

await runtime.process(firstEvent);
await runtime.process(secondEvent);
```

Use `plan(...)` to evaluate routing and report the listeners that would run
without invoking them:

```ts
const report = await runtime.plan(event);
```

`createRuntime(...)` validates the configuration once and reuses the supplied
context for every processed or planned event. Hosts should keep and reuse the
runtime instance rather than recreating it for each event.

## Logging

Hooksmith components obtain source-bound loggers from the `LoggerFactory` in the
execution context. The default factory handles source binding, message-template
rendering and minimum-level filtering while the host decides how normalized log
records are written.

```ts
import { createLoggerFactory, createRuntime } from "@hooksmith/runtime";

const logger = createLoggerFactory({
  minimumLevel: "debug",
  write(record) {
    console.error(
      `[${record.level.toUpperCase()}] [${record.source}] ${record.message}`,
    );
  },
});

const runtime = createRuntime(config, { logger });
```

The default minimum level is `info`. Supported emitted levels are `trace`,
`debug`, `info`, `warn`, and `error`. A minimum level of `none` disables all
logging. Entries are emitted when their level is greater than or equal to the
configured minimum level.

Log records preserve the original message template, structured properties, and
an optional error value in addition to the rendered human-readable message.
Missing template properties are left visible in the rendered message.

Framework components use stable source names. Named component instances qualify
the component type with their configured name, for example `HttpListener:slack`
or `Pipeline:announcement`.

## OpenTelemetry

The runtime is natively instrumented with the standard OpenTelemetry API. It
creates active spans for event processing/planning and listener execution and
emits counters and duration histograms for those boundaries. It does not install
or configure an OpenTelemetry SDK, provider, exporter, or collector.

With Deno's built-in OpenTelemetry integration, enable collection by setting
`OTEL_DENO=true`. For local inspection without a collector, use:

```sh
OTEL_DENO=true OTEL_EXPORTER_OTLP_PROTOCOL=console deno run -A main.ts
```

Consumers and extensions can use `@opentelemetry/api` directly. Their active
spans compose with Hooksmith's spans through the normal OpenTelemetry context;
no additional Hooksmith context property is required.

See [`../../docs/observability.md`](../../docs/observability.md) for the trace
model, metric names, provider setup guidance, and extension instrumentation
example.
