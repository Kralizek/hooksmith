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
import {
  createConsoleLogWriter,
  createLoggerFactory,
  createRuntime,
} from "@hooksmith/runtime";

const logger = createLoggerFactory({
  minimumLevel: "debug",
  write: createConsoleLogWriter(),
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

`nullLoggerFactory` provides a reusable no-op logger for hosts, tests, and
samples that intentionally do not want log output.

## OpenTelemetry

OpenTelemetry is fully opt-in. The base runtime package has no OpenTelemetry
dependency and uses the shared no-op telemetry backend from `@hooksmith/core` by
default.

Consumers that want Hooksmith traces and metrics enable the dedicated
integration package once:

```ts
import { enableOpenTelemetry } from "@hooksmith/opentelemetry";

enableOpenTelemetry();
```

That shared backend covers runtime, pipeline, and other Hooksmith packages that
emit telemetry through core. The integration does not install an SDK, provider,
exporter, or collector.

With Deno's built-in OpenTelemetry integration, `OTEL_DENO=true` can provide the
registered provider and exporter.

See [`../../docs/observability.md`](../../docs/observability.md) for the trace
model, metric names, provider setup guidance, logging paths, and extension
instrumentation example.
