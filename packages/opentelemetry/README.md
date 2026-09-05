# @hooksmith/opentelemetry

OpenTelemetry integration for Hooksmith.

The package installs one OpenTelemetry-backed telemetry implementation into the
shared `@hooksmith/core` telemetry singleton. All Hooksmith packages that emit
telemetry through core then participate automatically.

```ts
import { enableOpenTelemetry } from "@hooksmith/opentelemetry";

enableOpenTelemetry();
```

The package uses the global `@opentelemetry/api` providers. It does not install
or configure an SDK, exporter, collector, sampler, or backend.

With Deno's built-in integration, the provider/exporter can be enabled with
`OTEL_DENO=true`.

The package also exports `createOpenTelemetryLogWriter(...)`, an experimental
bridge for the JavaScript OpenTelemetry Logs API. The Logs API object is supplied
by the consumer so this package does not depend on the experimental logs
package.
