import {
  type Attributes,
  type Counter,
  type Histogram,
  metrics,
  trace,
} from "@opentelemetry/api";

export const tracer = trace.getTracer("@hooksmith/runtime");

interface RuntimeMetrics {
  eventsProcessed: Counter;
  eventDuration: Histogram;
  listenerInvocations: Counter;
  listenerDuration: Histogram;
}

let runtimeMetrics: RuntimeMetrics | undefined;

export function recordEventMetrics(
  durationSeconds: number,
  attributes: Attributes,
): void {
  const instruments = getRuntimeMetrics();
  instruments.eventsProcessed.add(1, attributes);
  instruments.eventDuration.record(durationSeconds, attributes);
}

export function recordListenerMetrics(
  durationSeconds: number,
  attributes: Attributes,
): void {
  const instruments = getRuntimeMetrics();
  instruments.listenerInvocations.add(1, attributes);
  instruments.listenerDuration.record(durationSeconds, attributes);
}

export function elapsedSeconds(startedAt: number): number {
  return (performance.now() - startedAt) / 1000;
}

function getRuntimeMetrics(): RuntimeMetrics {
  if (runtimeMetrics !== undefined) return runtimeMetrics;

  const meter = metrics.getMeter("@hooksmith/runtime");
  runtimeMetrics = {
    eventsProcessed: meter.createCounter(
      "hooksmith.event.processed",
      { unit: "{event}" },
    ),
    eventDuration: meter.createHistogram(
      "hooksmith.event.duration",
      { unit: "s" },
    ),
    listenerInvocations: meter.createCounter(
      "hooksmith.listener.invocation",
      { unit: "{invocation}" },
    ),
    listenerDuration: meter.createHistogram(
      "hooksmith.listener.duration",
      { unit: "s" },
    ),
  };

  return runtimeMetrics;
}
