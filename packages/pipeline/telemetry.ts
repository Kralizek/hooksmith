export type TelemetryAttributeValue = string | number | boolean;
export type TelemetryAttributes = Record<string, TelemetryAttributeValue>;

export interface TelemetrySpan {
  setAttribute(name: string, value: TelemetryAttributeValue): void;
  addEvent(name: string, attributes?: TelemetryAttributes): void;
  recordException(error: Error): void;
  setError(message?: string): void;
  end(): void;
}

export interface PipelineTelemetry {
  startActiveSpan<T>(
    name: string,
    attributes: TelemetryAttributes,
    run: (span: TelemetrySpan) => Promise<T>,
  ): Promise<T>;
  recordPipelineDuration(
    durationSeconds: number,
    attributes: TelemetryAttributes,
  ): void;
}

const noopSpan: TelemetrySpan = {
  setAttribute() {},
  addEvent() {},
  recordException() {},
  setError() {},
  end() {},
};

const noopTelemetry: PipelineTelemetry = {
  async startActiveSpan(_name, _attributes, run) {
    return await run(noopSpan);
  },
  recordPipelineDuration() {},
};

let pipelineTelemetry: PipelineTelemetry = noopTelemetry;

export function getPipelineTelemetry(): PipelineTelemetry {
  return pipelineTelemetry;
}

export function setPipelineTelemetry(telemetry: PipelineTelemetry): () => void {
  const previous = pipelineTelemetry;
  pipelineTelemetry = telemetry;
  return () => {
    pipelineTelemetry = previous;
  };
}

export function elapsedSeconds(startedAt: number): number {
  return (performance.now() - startedAt) / 1000;
}
