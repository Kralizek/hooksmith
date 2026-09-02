import { resolve } from "@std/path";

export type ReportFormat = "table" | "json" | "tsv";

export interface RunCliOptions {
  command: "run";
  eventFiles: string[];
  configFile: string;
  format: ReportFormat;
  plan: boolean;
  allowEmpty: boolean;
}

export interface StreamCliOptions {
  command: "stream";
  configFile: string;
}

export type CliOptions = RunCliOptions | StreamCliOptions;

export function parseArgs(args: string[]): CliOptions {
  if (args.length === 0) {
    throw new Error(usage());
  }

  switch (args[0]) {
    case "run":
      return parseRunArgs(args.slice(1));
    case "stream":
      return parseStreamArgs(args.slice(1));
    default:
      throw new Error(usage());
  }
}

function parseRunArgs(args: string[]): RunCliOptions {
  const eventFiles: string[] = [];
  let configFile = "hooksmith.config.ts";
  let format: ReportFormat = "table";
  let plan = false;
  let allowEmpty = false;

  for (let index = 0; index < args.length; index++) {
    const argument = args[index];

    switch (argument) {
      case "--config":
      case "-c": {
        const value = args[++index];
        if (value === undefined) {
          throw new Error(`${argument} requires a path.`);
        }
        configFile = value;
        break;
      }
      case "--format": {
        const value = args[++index];
        if (value === undefined) {
          throw new Error("--format requires a value.");
        }
        if (value !== "table" && value !== "json" && value !== "tsv") {
          throw new Error("--format must be one of: table, json, tsv.");
        }
        format = value;
        break;
      }
      case "--plan":
        plan = true;
        break;
      case "--allow-empty":
        allowEmpty = true;
        break;
      default:
        if (argument.startsWith("-") && argument !== "-") {
          throw new Error(`Unknown option: ${argument}`);
        }
        eventFiles.push(argument);
        break;
    }
  }

  if (eventFiles.length === 0) {
    throw new Error(
      "run requires at least one event file, glob, or - for stdin.",
    );
  }
  if (eventFiles.filter((path) => path === "-").length > 1) {
    throw new Error("run accepts stdin at most once.");
  }

  return {
    command: "run",
    eventFiles,
    configFile: resolve(configFile),
    format,
    plan,
    allowEmpty,
  };
}

function parseStreamArgs(args: string[]): StreamCliOptions {
  let configFile = "hooksmith.config.ts";

  for (let index = 0; index < args.length; index++) {
    const argument = args[index];

    switch (argument) {
      case "--config":
      case "-c": {
        const value = args[++index];
        if (value === undefined) {
          throw new Error(`${argument} requires a path.`);
        }
        configFile = value;
        break;
      }
      case "--plan":
        throw new Error("stream does not support --plan.");
      case "--format":
        throw new Error(
          "stream output is always NDJSON and does not support --format.",
        );
      case "--allow-empty":
        throw new Error("stream does not support --allow-empty.");
      default:
        throw new Error(`Unknown stream option: ${argument}`);
    }
  }

  return { command: "stream", configFile: resolve(configFile) };
}

export function usage(): string {
  return [
    "Hooksmith CLI",
    "",
    "Usage:",
    "  hooksmith --help",
    "  hooksmith -h",
    "  hooksmith --version",
    "  hooksmith -v",
    "  hooksmith run <event-file|glob|-> [event-file|glob...] [options]",
    "  hooksmith stream [options]",
    "",
    "Run options:",
    "  -c, --config <path>          Config file (default: hooksmith.config.ts)",
    "      --format table|json|tsv  Report format (default: table)",
    "      --plan                   Plan events without invoking listeners",
    "      --allow-empty            Allow a run that resolves to zero events",
    "",
    "Stream options:",
    "  -c, --config <path>          Config file (default: hooksmith.config.ts)",
    "",
    "run accepts YAML/JSON files, glob patterns, and bounded stdin. Each source",
    "may contain one event, an array of events, or multiple YAML documents.",
    "Glob matches are processed in deterministic path order.",
    "stream reads NDJSON from stdin and emits one NDJSON report per event.",
  ].join("\n");
}
