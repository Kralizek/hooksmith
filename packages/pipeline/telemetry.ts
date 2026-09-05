/** Scalar attribute value supported by Hooksmith telemetry adapters. */
export type TelemetryAttributeValue = string | number | boolean;

/** Structured attributes passed from pipelines to an optional telemetry adapter. */
export type TelemetryAttributes = Record<string, TelemetryAttributeValue>;

/** Minimal span surface used internally by the pipeline telemetry hook. */
export interface TelemetrySpan {
  setAttribute(name: string, value: TelemetryAttributeValue): void;
  addEvent(name: string, attributes?: TelemetryAttributes): void;
  recordException(error: Error): void;
  setError(message?: string): void;
  end(): void;
}

/** Optional pipeline telemetry hook used by integration adapters. */
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

/** Returns the currently configured pipeline telemetry hook. */
export function getPipelineTelemetry(): PipelineTelemetry {
  return pipelineTelemetry;
}

/** Installs a pipeline telemetry hook and returns a function that restores it. */
export function setPipelineTelemetry(telemetry: PipelineTelemetry): () => void {
  const previous = pipelineTelemetry;
  pipelineTelemetry = telemetry;
  return () => {
    pipelineTelemetry = previous;
  };
}

/** Returns elapsed wall-clock time in seconds from a performance timestamp. */
export function elapsedSeconds(startedAt: number): number {
  return (performance.now() - startedAt) / 1000;
}
