# Observability example

This example shows Hooksmith traces and metrics composing with telemetry emitted
by an extension. The application opts into Hooksmith OpenTelemetry once through
`@hooksmith/opentelemetry`; the base Hooksmith packages do not depend on
OpenTelemetry.

Run it with Deno's built-in console exporter:

```sh
OTEL_DENO=true \
OTEL_EXPORTER_OTLP_PROTOCOL=console \
OTEL_SERVICE_NAME=hooksmith-example \
deno task start
```

The trace contains Hooksmith's event, listener, and pipeline spans with the
extension-owned `example.publish` span nested below them. The console exporter
also prints the Hooksmith runtime/pipeline metrics and the example extension's
`example.messages.handled` counter.

Without `OTEL_DENO=true`, the same explicitly instrumented program still runs
and the OpenTelemetry API remains effectively no-op. Applications that do not
import `@hooksmith/opentelemetry` pull no OpenTelemetry dependencies through
Hooksmith.
