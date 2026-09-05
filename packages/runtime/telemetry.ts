import { metrics, trace } from "@opentelemetry/api";

export const tracer = trace.getTracer("@hooksmith/runtime");

const meter = metrics.getMeter("@hooksmith/runtime");

export const eventsProcessed = meter.createCounter(
  "hooksmith.event.processed",
  { unit: "{event}" },
);

export const eventDuration = meter.createHistogram(
  "hooksmith.event.duration",
  { unit: "s" },
);

export const listenerInvocations = meter.createCounter(
  "hooksmith.listener.invocation",
  { unit: "{invocation}" },
);

export const listenerDuration = meter.createHistogram(
  "hooksmith.listener.duration",
  { unit: "s" },
);

export function elapsedSeconds(startedAt: number): number {
  return (performance.now() - startedAt) / 1000;
}
