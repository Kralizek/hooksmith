import type {
  Logger,
  LoggerFactory,
  LogLevel,
  LogProperties,
} from "@hooksmith/core";

export type { LogLevel } from "@hooksmith/core";

/** Logging filter values supported by the default Hooksmith logger factory. */
export type LogLevelFilter = LogLevel | "none";

/** Normalized log entry produced by the default Hooksmith logger factory. */
export interface LogRecord {
  level: LogLevel;
  source: string;
  template: string;
  message: string;
  properties?: LogProperties;
  error?: unknown;
}

/** Options used to create the default Hooksmith logger factory. */
export interface LoggerFactoryOptions {
  minimumLevel?: LogLevelFilter;
  write(record: LogRecord): void;
}

const levelOrder: Record<LogLevelFilter, number> = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
  none: 5,
};

/**
 * Creates a source-aware logger factory with template rendering and level
 * filtering while leaving final log output to the host-provided writer.
 */
export function createLoggerFactory(
  options: LoggerFactoryOptions,
): LoggerFactory {
  const minimumLevel = options.minimumLevel ?? "info";

  return {
    getLogger(source: string): Logger {
      return {
        trace: (template, properties, error) =>
          write("trace", source, template, properties, error),
        debug: (template, properties, error) =>
          write("debug", source, template, properties, error),
        info: (template, properties, error) =>
          write("info", source, template, properties, error),
        warn: (template, properties, error) =>
          write("warn", source, template, properties, error),
        error: (template, properties, error) =>
          write("error", source, template, properties, error),
      };
    },
  };

  function write(
    level: LogLevel,
    source: string,
    template: string,
    properties?: LogProperties,
    error?: unknown,
  ): void {
    if (levelOrder[level] < levelOrder[minimumLevel]) return;

    options.write({
      level,
      source,
      template,
      message: renderLogTemplate(template, properties),
      properties,
      error,
    });
  }
}

/** Renders a log message template using the supplied structured properties. */
export function renderLogTemplate(
  template: string,
  properties?: LogProperties,
): string {
  if (properties === undefined) return template;

  return template.replace(/\{([^{}]+)\}/g, (placeholder, key: string) => {
    if (!(key in properties)) return placeholder;
    return renderLogValue(properties[key]);
  });
}

function renderLogValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (
    value === null ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    return String(value);
  }

  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}
