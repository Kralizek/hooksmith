import {
  setPipelineTelemetry,
  type TelemetryAttributes,
} from "./telemetry.ts";

interface OpenTelemetrySpan {
  setAttribute(name: string, value: string | number | boolean): void;
  addEvent(name: string, attributes?: TelemetryAttributes): void;
  recordException(error: Error): void;
  setStatus(status: { code: number; message?: string }): void;
  end(): void;
}

interface OpenTelemetryTracer {
  startActiveSpan<T>(
    name: string,
    options: { attributes: TelemetryAttributes },
    run: (span: OpenTelemetrySpan) => T,
  ): T;
}

interface OpenTelemetryTraceApi {
  getTracer(name: string): OpenTelemetryTracer;
}

interface OpenTelemetryHistogram {
  record(value: number, attributes?: TelemetryAttributes): void;
}

interface OpenTelemetryMeter {
  createHistogram(
    name: string,
    options?: { unit?: string },
  ): OpenTelemetryHistogram;
}

interface OpenTelemetryMetricsApi {
  getMeter(name: string): OpenTelemetryMeter;
}

/** OpenTelemetry trace and metrics APIs supplied by the consumer. */
export interface OpenTelemetryApis {
  trace: OpenTelemetryTraceApi;
  metrics: OpenTelemetryMetricsApi;
}

/**
 * Enables pipeline traces and metrics using consumer-supplied OpenTelemetry APIs.
 *
 * @returns A function that restores the previously configured telemetry adapter.
 */
export function enableOpenTelemetry(apis: OpenTelemetryApis): () => void {
  const tracer = apis.trace.getTracer("@hooksmith/pipeline");
  let pipelineDuration: OpenTelemetryHistogram | undefined;

  return setPipelineTelemetry({
    startActiveSpan(name, attributes, run) {
      return tracer.startActiveSpan(
        name,
        { attributes },
        async (span) => {
          return await run({
            setAttribute: (key, value) => span.setAttribute(key, value),
            addEvent: (eventName, values) => span.addEvent(eventName, values),
            recordException: (error) => span.recordException(error),
            setError: (message) => span.setStatus({ code: 2, message }),
            end: () => span.end(),
          });
        },
      );
    },
    recordPipelineDuration(durationSeconds, attributes) {
      const meter = apis.metrics.getMeter("@hooksmith/pipeline");
      pipelineDuration ??= meter.createHistogram(
        "hooksmith.pipeline.duration",
        { unit: "s" },
      );
      pipelineDuration.record(durationSeconds, attributes);
    },
  });
}
