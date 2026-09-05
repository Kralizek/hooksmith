/** Scalar attribute value supported by Hooksmith telemetry adapters. */
export type TelemetryAttributeValue = string | number | boolean;

/** Structured attributes passed from the runtime to an optional telemetry adapter. */
export type TelemetryAttributes = Record<string, TelemetryAttributeValue>;

/** Minimal span surface used internally by the runtime telemetry hook. */
export interface TelemetrySpan {
  setAttribute(name: string, value: TelemetryAttributeValue): void;
  setAttributes(attributes: TelemetryAttributes): void;
  addEvent(name: string, attributes?: TelemetryAttributes): void;
  recordException(error: Error): void;
  setError(message?: string): void;
  end(): void;
}

/** Optional runtime telemetry hook used by integration adapters. */
export interface RuntimeTelemetry {
  startActiveSpan<T>(
    name: string,
    attributes: TelemetryAttributes,
    run: (span: TelemetrySpan) => Promise<T>,
  ): Promise<T>;
  recordEventMetrics(
    durationSeconds: number,
    attributes: TelemetryAttributes,
  ): void;
  recordListenerMetrics(
    durationSeconds: number,
    attributes: TelemetryAttributes,
  ): void;
}

const noopSpan: TelemetrySpan = {
  setAttribute() {},
  setAttributes() {},
  addEvent() {},
  recordException() {},
  setError() {},
  end() {},
};

const noopTelemetry: RuntimeTelemetry = {
  async startActiveSpan(_name, _attributes, run) {
    return await run(noopSpan);
  },
  recordEventMetrics() {},
  recordListenerMetrics() {},
};

let runtimeTelemetry: RuntimeTelemetry = noopTelemetry;

/** Returns the currently configured runtime telemetry hook. */
export function getRuntimeTelemetry(): RuntimeTelemetry {
  return runtimeTelemetry;
}

/** Installs a runtime telemetry hook and returns a function that restores it. */
export function setRuntimeTelemetry(telemetry: RuntimeTelemetry): () => void {
  const previous = runtimeTelemetry;
  runtimeTelemetry = telemetry;
  return () => {
    runtimeTelemetry = previous;
  };
}

/** Returns elapsed wall-clock time in seconds from a performance timestamp. */
export function elapsedSeconds(startedAt: number): number {
  return (performance.now() - startedAt) / 1000;
}
