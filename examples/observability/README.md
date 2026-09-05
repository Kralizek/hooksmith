# Observability example

This example shows Hooksmith traces and metrics composing with telemetry emitted
by an extension. Hooksmith and the extension use only the standard OpenTelemetry
API; Deno supplies the provider and exporter when telemetry is enabled.

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

Without `OTEL_DENO=true`, the same program still runs and the OpenTelemetry API
remains effectively no-op.
