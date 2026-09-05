# Observability

Hooksmith observability is opt-in. The base `@hooksmith/runtime` and
`@hooksmith/pipeline` packages do not depend on OpenTelemetry and use internal
no-op telemetry hooks unless an adapter is explicitly enabled.

This means an application that does not use telemetry has no OpenTelemetry
packages in its dependency graph because of Hooksmith.

## Enable OpenTelemetry

Consumers that want traces and metrics import the OpenTelemetry API themselves
and pass its global APIs to Hooksmith's optional adapter subpaths:

```ts
import { metrics, trace } from "npm:@opentelemetry/api@^1.9";
import { enableOpenTelemetry as enablePipelineOpenTelemetry } from "@hooksmith/pipeline/opentelemetry";
import { enableOpenTelemetry as enableRuntimeOpenTelemetry } from "@hooksmith/runtime/opentelemetry";

enableRuntimeOpenTelemetry({ trace, metrics });
enablePipelineOpenTelemetry({ trace, metrics });
```

The adapters do not import OpenTelemetry themselves. They accept the consumer's
API objects structurally and translate Hooksmith's semantic operations into OTel
spans and metrics.

Without these calls, Hooksmith runs through dependency-free no-op telemetry
hooks and its execution semantics are unchanged.

## Deno

Deno has built-in OpenTelemetry support. When `OTEL_DENO=true` is set, Deno
registers providers for the standard OpenTelemetry API and can export traces,
metrics, and console logs through OTLP.

A local console-exporter run can therefore use:

```sh
OTEL_DENO=true \
OTEL_EXPORTER_OTLP_PROTOCOL=console \
OTEL_SERVICE_NAME=my-hooksmith-app \
deno run -A main.ts
```

The application still explicitly imports `@opentelemetry/api` and enables the
Hooksmith adapters as shown above. Deno supplies the provider and exporter.

Deno also instruments native `fetch` calls, so HTTP client spans become children
of the active Hooksmith or extension span without Hooksmith creating duplicate
HTTP spans.

## Trace model

When the adapters are enabled, the runtime creates active spans around its main
semantic execution boundaries:

```text
consumer operation
└─ hooksmith.event.process
   └─ hooksmith.listener
      └─ hooksmith.pipeline
         └─ extension span
            └─ Deno fetch span
```

Planning uses `hooksmith.event.plan`. Enrichers, route matches, condition
evaluations, fallback selection, and individual pipeline transformations are
represented as span events rather than additional child spans.

Hooksmith uses bounded execution attributes such as `hooksmith.event.type`,
`hooksmith.mode`, `hooksmith.outcome`, `hooksmith.route`,
`hooksmith.listener`, `hooksmith.pipeline`, and `hooksmith.status`.

## Metrics

The adapters emit synchronous instruments:

| Instrument                      | Type      | Unit           |
| ------------------------------- | --------- | -------------- |
| `hooksmith.event.processed`     | Counter   | `{event}`      |
| `hooksmith.event.duration`      | Histogram | `s`            |
| `hooksmith.listener.invocation` | Counter   | `{invocation}` |
| `hooksmith.listener.duration`   | Histogram | `s`            |
| `hooksmith.pipeline.duration`   | Histogram | `s`            |

Metric attributes intentionally exclude event IDs, subject IDs, source IDs,
URLs, trace IDs, and other high-cardinality values.

Metric instruments are created lazily after the adapter is enabled, so importing
Hooksmith before the application configures its OTel provider does not bind
metrics to an earlier no-op provider.

## Consumer instrumentation

A consumer can create a parent span through its own OpenTelemetry API. Hooksmith
will attach below the active context:

```ts
const tracer = trace.getTracer("my-application");

await tracer.startActiveSpan("deployment.finalize", async (span) => {
  try {
    await runtime.process(event);
  } finally {
    span.end();
  }
});
```

## Extension instrumentation

Extensions that want their own telemetry should use OpenTelemetry directly and
use their package name as the instrumentation scope. No Hooksmith tracer or meter
abstraction is exposed to extension authors.

```ts
import { metrics, trace } from "npm:@opentelemetry/api@^1.9";

const tracer = trace.getTracer("@acme/hooksmith-publisher");
const meter = metrics.getMeter("@acme/hooksmith-publisher");
```

Because Hooksmith invokes extensions while its semantic span is active,
extension spans naturally become children and instrumented downstream work can
continue the same trace.

## Logging

Hooksmith logging remains independent from OpenTelemetry.

For the stable Deno path, hosts can use the console writer:

```ts
import {
  createConsoleLogWriter,
  createLoggerFactory,
} from "@hooksmith/runtime";

const logger = createLoggerFactory({
  write: createConsoleLogWriter(),
});
```

When Deno telemetry is enabled, Deno can capture those `console.*` calls into its
OTel log pipeline and correlate them with the active trace context.

### Experimental direct OpenTelemetry Logs bridge

`@hooksmith/runtime/opentelemetry` also exports
`createOpenTelemetryLogWriter(...)`. The consumer supplies the experimental
JavaScript Logs API itself:

```ts
import { logs } from "npm:@opentelemetry/api-logs";
import { createLoggerFactory } from "@hooksmith/runtime";
import { createOpenTelemetryLogWriter } from "@hooksmith/runtime/opentelemetry";

const logger = createLoggerFactory({
  write: createOpenTelemetryLogWriter(logs),
});
```

This bridge is explicitly experimental. The OpenTelemetry Logs specification is
stable, but the JavaScript Logs implementation and `@opentelemetry/api-logs`
package are still under active development and may introduce breaking changes.
Hooksmith does not depend on that package; only consumers choosing this bridge
need to import it.

See [`examples/observability`](../examples/observability) for a runnable trace
and metrics example.
