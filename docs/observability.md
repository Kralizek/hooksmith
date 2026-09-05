# Observability

Hooksmith emits traces and metrics through the standard OpenTelemetry JavaScript
API. The runtime and pipeline packages depend only on `@opentelemetry/api`; they
do not configure an SDK, provider, exporter, collector, or telemetry backend.

This keeps observability opt-in for consumers. If no OpenTelemetry provider is
configured, the API behaves as a no-op. When telemetry is enabled, Hooksmith
participates in the consumer's existing trace and metric pipeline.

## Deno

Deno has built-in OpenTelemetry support. Set `OTEL_DENO=true` to enable its
provider and OTLP exporter. To inspect telemetry locally without a collector,
use Deno's console exporter:

```sh
OTEL_DENO=true \
OTEL_EXPORTER_OTLP_PROTOCOL=console \
OTEL_SERVICE_NAME=my-hooksmith-app \
deno run -A main.ts
```

Deno also instruments native `fetch` calls. HTTP client spans therefore become
children of the active Hooksmith or extension span without Hooksmith creating a
second HTTP span.

For a remote collector or backend, configure the standard OpenTelemetry
environment variables such as `OTEL_EXPORTER_OTLP_ENDPOINT`,
`OTEL_EXPORTER_OTLP_PROTOCOL`, `OTEL_EXPORTER_OTLP_HEADERS`, and
`OTEL_SERVICE_NAME`.

## Trace model

The runtime creates active spans for the main execution boundaries:

```text
consumer operation
└─ hooksmith.event.process
   └─ hooksmith.listener
      └─ hooksmith.pipeline
         └─ extension span
            └─ Deno fetch span
```

Planning uses `hooksmith.event.plan` instead of `hooksmith.event.process`.
Enrichers, route matches, condition evaluations, fallback execution, and
individual pipeline transformations are represented as span events rather than
additional child spans.

The initial Hooksmith span attributes include bounded execution metadata such as
`hooksmith.event.type`, `hooksmith.mode`, `hooksmith.outcome`,
`hooksmith.route`, `hooksmith.listener`, `hooksmith.pipeline`, and
`hooksmith.status`.

## Metrics

Hooksmith currently emits these synchronous instruments:

| Instrument | Type | Unit |
| --- | --- | --- |
| `hooksmith.event.processed` | Counter | `{event}` |
| `hooksmith.event.duration` | Histogram | `s` |
| `hooksmith.listener.invocation` | Counter | `{invocation}` |
| `hooksmith.listener.duration` | Histogram | `s` |
| `hooksmith.pipeline.duration` | Histogram | `s` |

Metric attributes are intentionally bounded. Hooksmith does not use event IDs,
subject IDs, source IDs, URLs, trace IDs, or other high-cardinality values as
metric dimensions.

## Consumer instrumentation

A consumer can create a parent span with the normal OpenTelemetry API. Hooksmith
will attach its active spans below it:

```ts
import { trace } from "@opentelemetry/api";

const tracer = trace.getTracer("my-application");

await tracer.startActiveSpan("deployment.finalize", async (span) => {
  try {
    await runtime.process(event);
  } finally {
    span.end();
  }
});
```

If a consumer configures the JavaScript OpenTelemetry SDK in code rather than
using Deno's built-in integration, it should configure the global providers
before processing Hooksmith events. Hooksmith creates metric instruments lazily
on first use so importing the package before provider setup is safe.

## Extension instrumentation

Extensions should also use the OpenTelemetry API directly and use their package
name as their instrumentation scope. No Hooksmith telemetry abstraction or
execution-context property is required.

```ts
import { metrics, trace } from "@opentelemetry/api";
import type { Event, Listener } from "@hooksmith/core";

const tracer = trace.getTracer("@acme/hooksmith-publisher");
const meter = metrics.getMeter("@acme/hooksmith-publisher");
const published = meter.createCounter("acme.messages.published");

export function publish<TEvent extends Event>(): Listener<TEvent> {
  return {
    name: "acme-publisher",
    run(event) {
      return tracer.startActiveSpan("acme.publish", async (span) => {
        try {
          await send(event);
          published.add(1, { status: "success" });
          return { success: true };
        } catch (error) {
          span.recordException(error as Error);
          published.add(1, { status: "error" });
          throw error;
        } finally {
          span.end();
        }
      });
    },
  };
}
```

Because Hooksmith invokes the listener inside an active span, `acme.publish`
becomes its child. Any instrumented work performed by the extension can continue
the same trace automatically.

See [`examples/observability`](../examples/observability) for a runnable example.
