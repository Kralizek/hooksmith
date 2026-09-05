import {
  getTelemetry,
  type TelemetryAttributes,
  type TelemetrySpan,
} from "@hooksmith/core";

const scope = "@hooksmith/pipeline";

/** Starts an active pipeline telemetry span. */
export function startActiveSpan<T>(
  name: string,
  attributes: TelemetryAttributes,
  run: (span: TelemetrySpan) => Promise<T>,
): Promise<T> {
  return getTelemetry().startActiveSpan(scope, name, attributes, run);
}

/** Records pipeline duration. */
export function recordPipelineDuration(
  durationSeconds: number,
  attributes: TelemetryAttributes,
): void {
  getTelemetry().histogram(
    scope,
    "hooksmith.pipeline.duration",
    { unit: "s" },
  ).record(durationSeconds, attributes);
}

/** Returns elapsed wall-clock time in seconds from a performance timestamp. */
export function elapsedSeconds(startedAt: number): number {
  return (performance.now() - startedAt) / 1000;
}
