import {
  getTelemetry,
  type TelemetryAttributes,
  type TelemetrySpan,
} from "@hooksmith/core";

const scope = "@hooksmith/runtime";

/** Starts an active runtime telemetry span. */
export function startActiveSpan<T>(
  name: string,
  attributes: TelemetryAttributes,
  run: (span: TelemetrySpan) => Promise<T>,
): Promise<T> {
  return getTelemetry().startActiveSpan(scope, name, attributes, run);
}

/** Records event execution count and duration metrics. */
export function recordEventMetrics(
  durationSeconds: number,
  attributes: TelemetryAttributes,
): void {
  const telemetry = getTelemetry();
  telemetry.counter(
    scope,
    "hooksmith.event.processed",
    { unit: "{event}" },
  ).add(1, attributes);
  telemetry.histogram(
    scope,
    "hooksmith.event.duration",
    { unit: "s" },
  ).record(durationSeconds, attributes);
}

/** Records listener invocation count and duration metrics. */
export function recordListenerMetrics(
  durationSeconds: number,
  attributes: TelemetryAttributes,
): void {
  const telemetry = getTelemetry();
  telemetry.counter(
    scope,
    "hooksmith.listener.invocation",
    { unit: "{invocation}" },
  ).add(1, attributes);
  telemetry.histogram(
    scope,
    "hooksmith.listener.duration",
    { unit: "s" },
  ).record(durationSeconds, attributes);
}

/** Returns elapsed wall-clock time in seconds from a performance timestamp. */
export function elapsedSeconds(startedAt: number): number {
  return (performance.now() - startedAt) / 1000;
}
