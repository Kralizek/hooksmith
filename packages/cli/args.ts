import {
  argument,
  choice,
  command,
  constant,
  flag,
  multiple,
  object,
  option,
  or,
  runParserSync,
  string,
  withDefault,
} from "@optique/core";
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

const parser = or(
  command(
    "run",
    object({
      command: constant("run" as const),
      eventFiles: multiple(argument(string()), { min: 1 }),
      configFile: withDefault(
        option("-c", "--config", string()),
        "hooksmith.config.ts",
      ),
      format: withDefault(
        option("--format", choice(["table", "json", "tsv"] as const)),
        "table" as const,
      ),
      plan: withDefault(flag("--plan"), false),
      allowEmpty: withDefault(flag("--allow-empty"), false),
    }),
  ),
  command(
    "stream",
    object({
      command: constant("stream" as const),
      configFile: withDefault(
        option("-c", "--config", string()),
        "hooksmith.config.ts",
      ),
    }),
  ),
);

export function parseArgs(args: string[]): CliOptions {
  if (args.length === 0) {
    throw new Error(usage());
  }

  const parsed = runParserSync(parser, "hooksmith", args);

  if (parsed.command === "run") {
    const eventFiles = [...parsed.eventFiles];
    if (eventFiles.filter((path) => path === "-").length > 1) {
      throw new Error("run accepts stdin at most once.");
    }

    return {
      command: "run",
      eventFiles,
      configFile: resolve(parsed.configFile),
      format: parsed.format,
      plan: parsed.plan,
      allowEmpty: parsed.allowEmpty,
    };
  }

  return {
    command: "stream",
    configFile: resolve(parsed.configFile),
  };
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
