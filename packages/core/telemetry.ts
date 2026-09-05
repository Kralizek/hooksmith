/** Primitive value supported by Hooksmith telemetry attributes. */
export type TelemetryAttributeValue = string | number | boolean;

/** Bounded attributes attached to Hooksmith telemetry operations. */
export type TelemetryAttributes = Record<string, TelemetryAttributeValue>;

/** Span operations required by Hooksmith instrumentation. */
export interface TelemetrySpan {
  setAttribute(name: string, value: TelemetryAttributeValue): void;
  setAttributes(attributes: TelemetryAttributes): void;
  addEvent(name: string, attributes?: TelemetryAttributes): void;
  recordException(error: Error): void;
  setError(message?: string): void;
  end(): void;
}

/** Counter instrument required by Hooksmith metrics. */
export interface TelemetryCounter {
  add(value: number, attributes?: TelemetryAttributes): void;
}

/** Histogram instrument required by Hooksmith metrics. */
export interface TelemetryHistogram {
  record(value: number, attributes?: TelemetryAttributes): void;
}

/** Options shared by Hooksmith metric instruments. */
export interface TelemetryInstrumentOptions {
  unit?: string;
}

/**
 * Backend-neutral telemetry contract shared by Hooksmith packages.
 *
 * The scope identifies the package that owns the instrumentation, for example
 * `@hooksmith/runtime` or `@hooksmith/pipeline`.
 */
export interface Telemetry {
  startActiveSpan<T>(
    scope: string,
    name: string,
    attributes: TelemetryAttributes,
    run: (span: TelemetrySpan) => Promise<T>,
  ): Promise<T>;
  counter(
    scope: string,
    name: string,
    options?: TelemetryInstrumentOptions,
  ): TelemetryCounter;
  histogram(
    scope: string,
    name: string,
    options?: TelemetryInstrumentOptions,
  ): TelemetryHistogram;
}

const noopSpan: TelemetrySpan = {
  setAttribute() {},
  setAttributes() {},
  addEvent() {},
  recordException() {},
  setError() {},
  end() {},
};

const noopCounter: TelemetryCounter = {
  add() {},
};

const noopHistogram: TelemetryHistogram = {
  record() {},
};

const noopTelemetry: Telemetry = {
  async startActiveSpan(_scope, _name, _attributes, run) {
    return await run(noopSpan);
  },
  counter() {
    return noopCounter;
  },
  histogram() {
    return noopHistogram;
  },
};

let telemetry: Telemetry = noopTelemetry;

/** Returns the telemetry backend currently configured for Hooksmith. */
export function getTelemetry(): Telemetry {
  return telemetry;
}

/**
 * Replaces the process-wide Hooksmith telemetry backend.
 *
 * @returns A function that restores the previously configured backend.
 */
export function setTelemetry(value: Telemetry): () => void {
  const previous = telemetry;
  telemetry = value;
  return () => {
    telemetry = previous;
  };
}
