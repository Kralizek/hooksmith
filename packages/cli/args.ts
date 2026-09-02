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
import cliMetadata from "./deno.json" with { type: "json" };

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

export const VERSION = cliMetadata.version;

const parser = or(
  command(
    "run",
    object({
      command: constant("run" as const),
      eventFiles: multiple(argument(string()), { min: 1 }),
      configFile: withDefault(
        option("-c", "--config", string(), { description: "Config file." }),
        "hooksmith.config.ts",
      ),
      format: withDefault(
        option(
          "--format",
          choice(["table", "json", "tsv"] as const),
          { description: "Report format." },
        ),
        "table" as const,
      ),
      plan: withDefault(
        flag("--plan", {
          description: "Plan events without invoking listeners.",
        }),
        false,
      ),
      allowEmpty: withDefault(
        flag("--allow-empty", {
          description: "Allow a run that resolves to zero events.",
        }),
        false,
      ),
    }),
    { brief: "Process one or more bounded event inputs." },
  ),
  command(
    "stream",
    object({
      command: constant("stream" as const),
      configFile: withDefault(
        option("-c", "--config", string(), { description: "Config file." }),
        "hooksmith.config.ts",
      ),
    }),
    { brief: "Read NDJSON events from stdin and emit NDJSON reports." },
  ),
);

export function parseArgs(args: string[]): CliOptions | undefined {
  const parsed = runParserSync(
    parser,
    "hooksmith",
    args.length === 0 ? ["--help"] : args,
    {
      brief: "Process events with Hooksmith.",
      help: {
        command: { names: ["help"] },
        option: { names: ["-h", "--help"] },
        onShow: () => undefined,
      },
      version: {
        value: VERSION,
        command: { names: ["version"] },
        option: { names: ["-v", "--version"] },
        onShow: () => undefined,
      },
      showChoices: true,
      showDefault: true,
    },
  );

  if (parsed === undefined) {
    return undefined;
  }

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
