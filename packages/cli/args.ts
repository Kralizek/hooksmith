import { Command, EnumType } from "@cliffy/command";
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

const reportFormatType = new EnumType(["table", "json", "tsv"] as const);

export async function parseArgs(args: string[]): Promise<CliOptions> {
  if (args.length === 0) {
    throw new Error(usage());
  }

  let options: CliOptions | undefined;

  const run = new Command()
    .description("Process one or more bounded event inputs.")
    .type("report-format", reportFormatType)
    .arguments("<eventFile:string> [...eventFiles:string]")
    .option(
      "-c, --config <path:string>",
      "Config file.",
      { default: "hooksmith.config.ts" },
    )
    .option(
      "--format <format:report-format>",
      "Report format.",
      { default: "table" },
    )
    .option("--plan", "Plan events without invoking listeners.")
    .option("--allow-empty", "Allow a run that resolves to zero events.")
    .action((parsed, eventFile, ...eventFiles) => {
      const inputs = [eventFile, ...eventFiles];
      if (inputs.filter((path) => path === "-").length > 1) {
        throw new Error("run accepts stdin at most once.");
      }

      options = {
        command: "run",
        eventFiles: inputs,
        configFile: resolve(parsed.config),
        format: parsed.format,
        plan: parsed.plan ?? false,
        allowEmpty: parsed.allowEmpty ?? false,
      };
    });

  const stream = new Command()
    .description("Read NDJSON events from stdin and emit NDJSON reports.")
    .option(
      "-c, --config <path:string>",
      "Config file.",
      { default: "hooksmith.config.ts" },
    )
    .action((parsed) => {
      options = {
        command: "stream",
        configFile: resolve(parsed.config),
      };
    });

  await new Command()
    .name("hooksmith")
    .description("Process events with Hooksmith.")
    .helpOption(false)
    .versionOption(false)
    .throwErrors()
    .command("run", run)
    .command("stream", stream)
    .parse(args);

  if (options === undefined) {
    throw new Error(usage());
  }

  return options;
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
