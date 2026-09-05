import { metrics, trace } from "@opentelemetry/api";

export const tracer = trace.getTracer("@hooksmith/pipeline");

const meter = metrics.getMeter("@hooksmith/pipeline");

export const pipelineDuration = meter.createHistogram(
  "hooksmith.pipeline.duration",
  { unit: "s" },
);

export function elapsedSeconds(startedAt: number): number {
  return (performance.now() - startedAt) / 1000;
}
