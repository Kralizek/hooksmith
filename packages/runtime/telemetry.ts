export type TelemetryAttributeValue = string | number | boolean;
export type TelemetryAttributes = Record<string, TelemetryAttributeValue>;

export interface TelemetrySpan {
  setAttribute(name: string, value: TelemetryAttributeValue): void;
  setAttributes(attributes: TelemetryAttributes): void;
  addEvent(name: string, attributes?: TelemetryAttributes): void;
  recordException(error: Error): void;
  setError(message?: string): void;
  end(): void;
}

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

export function getRuntimeTelemetry(): RuntimeTelemetry {
  return runtimeTelemetry;
}

export function setRuntimeTelemetry(telemetry: RuntimeTelemetry): () => void {
  const previous = runtimeTelemetry;
  runtimeTelemetry = telemetry;
  return () => {
    runtimeTelemetry = previous;
  };
}

export function elapsedSeconds(startedAt: number): number {
  return (performance.now() - startedAt) / 1000;
}
