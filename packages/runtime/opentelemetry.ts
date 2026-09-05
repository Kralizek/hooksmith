import type { LogRecord, LogWriter } from "./logging.ts";
import { setRuntimeTelemetry, type TelemetryAttributes } from "./telemetry.ts";

interface OpenTelemetrySpan {
  setAttribute(name: string, value: string | number | boolean): void;
  setAttributes(attributes: TelemetryAttributes): void;
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

interface OpenTelemetryCounter {
  add(value: number, attributes?: TelemetryAttributes): void;
}

interface OpenTelemetryHistogram {
  record(value: number, attributes?: TelemetryAttributes): void;
}

interface OpenTelemetryMeter {
  createCounter(
    name: string,
    options?: { unit?: string },
  ): OpenTelemetryCounter;
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
 * Enables runtime traces and metrics using consumer-supplied OpenTelemetry APIs.
 *
 * @returns A function that restores the previously configured telemetry adapter.
 */
export function enableOpenTelemetry(apis: OpenTelemetryApis): () => void {
  const tracer = apis.trace.getTracer("@hooksmith/runtime");
  let eventsProcessed: OpenTelemetryCounter | undefined;
  let eventDuration: OpenTelemetryHistogram | undefined;
  let listenerInvocations: OpenTelemetryCounter | undefined;
  let listenerDuration: OpenTelemetryHistogram | undefined;

  function getMeter(): OpenTelemetryMeter {
    return apis.metrics.getMeter("@hooksmith/runtime");
  }

  return setRuntimeTelemetry({
    startActiveSpan(name, attributes, run) {
      return tracer.startActiveSpan(
        name,
        { attributes },
        async (span) => {
          return await run({
            setAttribute: (key, value) => span.setAttribute(key, value),
            setAttributes: (values) => span.setAttributes(values),
            addEvent: (eventName, values) => span.addEvent(eventName, values),
            recordException: (error) => span.recordException(error),
            setError: (message) => span.setStatus({ code: 2, message }),
            end: () => span.end(),
          });
        },
      );
    },
    recordEventMetrics(durationSeconds, attributes) {
      const meter = getMeter();
      eventsProcessed ??= meter.createCounter(
        "hooksmith.event.processed",
        { unit: "{event}" },
      );
      eventDuration ??= meter.createHistogram(
        "hooksmith.event.duration",
        { unit: "s" },
      );
      eventsProcessed.add(1, attributes);
      eventDuration.record(durationSeconds, attributes);
    },
    recordListenerMetrics(durationSeconds, attributes) {
      const meter = getMeter();
      listenerInvocations ??= meter.createCounter(
        "hooksmith.listener.invocation",
        { unit: "{invocation}" },
      );
      listenerDuration ??= meter.createHistogram(
        "hooksmith.listener.duration",
        { unit: "s" },
      );
      listenerInvocations.add(1, attributes);
      listenerDuration.record(durationSeconds, attributes);
    },
  });
}

interface OpenTelemetryLogger {
  emit(record: {
    severityNumber?: number;
    severityText?: string;
    body?: string;
    attributes?: Record<string, string | number | boolean>;
  }): void;
}

/** Experimental OpenTelemetry Logs API supplied by the consumer. */
export interface OpenTelemetryLogsApi {
  getLogger(name: string): OpenTelemetryLogger;
}

/**
 * Creates a writer that bridges Hooksmith log records to OpenTelemetry Logs.
 *
 * @experimental OpenTelemetry Logs support in JavaScript is still in
 * development and this integration may change in future Hooksmith releases.
 */
export function createOpenTelemetryLogWriter(
  logs: OpenTelemetryLogsApi,
): LogWriter {
  let logger: OpenTelemetryLogger | undefined;

  return (record) => {
    logger ??= logs.getLogger("@hooksmith/runtime");
    logger.emit({
      severityNumber: severityNumber(record.level),
      severityText: record.level.toUpperCase(),
      body: record.message,
      attributes: logAttributes(record),
    });
  };
}

function severityNumber(level: LogRecord["level"]): number {
  switch (level) {
    case "trace":
      return 1;
    case "debug":
      return 5;
    case "info":
      return 9;
    case "warn":
      return 13;
    case "error":
      return 17;
  }
}

function logAttributes(
  record: LogRecord,
): Record<string, string | number | boolean> {
  const attributes: Record<string, string | number | boolean> = {
    "hooksmith.log.source": record.source,
    "hooksmith.log.template": record.template,
  };

  for (const [key, value] of Object.entries(record.properties ?? {})) {
    attributes[key] = toLogAttribute(value);
  }

  if (record.error instanceof Error) {
    attributes["exception.type"] = record.error.name;
    attributes["exception.message"] = record.error.message;
    if (record.error.stack !== undefined) {
      attributes["exception.stacktrace"] = record.error.stack;
    }
  } else if (record.error !== undefined) {
    attributes["exception.message"] = String(record.error);
  }

  return attributes;
}

function toLogAttribute(value: unknown): string | number | boolean {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (value === null || value === undefined) {
    return String(value);
  }

  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}
