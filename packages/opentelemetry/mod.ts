import {
  type Counter,
  type Histogram,
  metrics,
  SpanStatusCode,
  trace,
} from "@opentelemetry/api";
import {
  setTelemetry,
  type Telemetry,
  type TelemetryAttributes,
  type TelemetryCounter,
  type TelemetryHistogram,
  type TelemetryInstrumentOptions,
} from "@hooksmith/core";

/**
 * Enables OpenTelemetry for all Hooksmith packages through the shared core
 * telemetry backend.
 *
 * @returns A function that restores the previously configured telemetry backend.
 */
export function enableOpenTelemetry(): () => void {
  return setTelemetry(createOpenTelemetry());
}

/** Creates a Hooksmith telemetry backend backed by the global OpenTelemetry API. */
export function createOpenTelemetry(): Telemetry {
  const counters = new Map<string, Counter>();
  const histograms = new Map<string, Histogram>();

  return {
    startActiveSpan(scope, name, attributes, run) {
      const tracer = trace.getTracer(scope);
      return tracer.startActiveSpan(
        name,
        { attributes },
        async (span) => {
          return await run({
            setAttribute: (key, value) => span.setAttribute(key, value),
            setAttributes: (values) => span.setAttributes(values),
            addEvent: (eventName, values) => span.addEvent(eventName, values),
            recordException: (error) => span.recordException(error),
            setError: (message) =>
              span.setStatus({ code: SpanStatusCode.ERROR, message }),
            end: () => span.end(),
          });
        },
      );
    },

    counter(scope, name, options) {
      const key = instrumentKey(scope, name, options);
      const counter = counters.get(key) ?? createCounter(scope, name, options);
      counters.set(key, counter);
      return toTelemetryCounter(counter);
    },

    histogram(scope, name, options) {
      const key = instrumentKey(scope, name, options);
      const histogram = histograms.get(key) ??
        createHistogram(scope, name, options);
      histograms.set(key, histogram);
      return toTelemetryHistogram(histogram);
    },
  };
}

function createCounter(
  scope: string,
  name: string,
  options?: TelemetryInstrumentOptions,
): Counter {
  return metrics.getMeter(scope).createCounter(name, options);
}

function createHistogram(
  scope: string,
  name: string,
  options?: TelemetryInstrumentOptions,
): Histogram {
  return metrics.getMeter(scope).createHistogram(name, options);
}

function toTelemetryCounter(counter: Counter): TelemetryCounter {
  return {
    add(value, attributes) {
      counter.add(value, attributes);
    },
  };
}

function toTelemetryHistogram(histogram: Histogram): TelemetryHistogram {
  return {
    record(value, attributes) {
      histogram.record(value, attributes);
    },
  };
}

function instrumentKey(
  scope: string,
  name: string,
  options?: TelemetryInstrumentOptions,
): string {
  return `${scope}\u0000${name}\u0000${options?.unit ?? ""}`;
}

/** Structured Hooksmith log record accepted by the OpenTelemetry log bridge. */
export interface HooksmithLogRecord {
  level: "trace" | "debug" | "info" | "warn" | "error";
  source: string;
  template: string;
  message: string;
  properties?: Record<string, unknown>;
  error?: unknown;
}

/** Experimental OpenTelemetry Logs API supplied by the consumer. */
export interface OpenTelemetryLogsApi {
  getLogger(name: string): {
    emit(record: {
      severityNumber?: number;
      severityText?: string;
      body?: string;
      attributes?: TelemetryAttributes;
    }): void;
  };
}

/**
 * Creates a writer that bridges Hooksmith log records to OpenTelemetry Logs.
 *
 * @experimental OpenTelemetry Logs support in JavaScript is still in
 * development and this integration may change in future Hooksmith releases.
 */
export function createOpenTelemetryLogWriter(
  logs: OpenTelemetryLogsApi,
): (record: HooksmithLogRecord) => void {
  let logger: ReturnType<OpenTelemetryLogsApi["getLogger"]> | undefined;

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

function severityNumber(level: HooksmithLogRecord["level"]): number {
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

function logAttributes(record: HooksmithLogRecord): TelemetryAttributes {
  const attributes: TelemetryAttributes = {
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
