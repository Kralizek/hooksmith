import {
  type Attributes,
  type Histogram,
  metrics,
  trace,
} from "@opentelemetry/api";

export const tracer = trace.getTracer("@hooksmith/pipeline");

let pipelineDuration: Histogram | undefined;

export function recordPipelineDuration(
  durationSeconds: number,
  attributes: Attributes,
): void {
  const histogram = pipelineDuration ??= metrics
    .getMeter("@hooksmith/pipeline")
    .createHistogram("hooksmith.pipeline.duration", { unit: "s" });
  histogram.record(durationSeconds, attributes);
}

export function elapsedSeconds(startedAt: number): number {
  return (performance.now() - startedAt) / 1000;
}
