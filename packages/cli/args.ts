import { Command, EnumType } from "@cliffy/command";
import { HelpCommand } from "@cliffy/command/help";
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

const reportFormatType = new EnumType(["table", "json", "tsv"] as const);

export async function parseArgs(
  args: string[],
): Promise<CliOptions | undefined> {
  let options: CliOptions | undefined;

  await createCommand((parsed) => {
    options = parsed;
  }).parse(args);

  return options;
}

export function usage(): string {
  return createCommand(() => undefined).getHelp();
}

function createCommand(setOptions: (options: CliOptions) => void) {
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

      setOptions({
        command: "run",
        eventFiles: inputs,
        configFile: resolve(parsed.config),
        format: parsed.format,
        plan: parsed.plan ?? false,
        allowEmpty: parsed.allowEmpty ?? false,
      });
    });

  const stream = new Command()
    .description("Read NDJSON events from stdin and emit NDJSON reports.")
    .option(
      "-c, --config <path:string>",
      "Config file.",
      { default: "hooksmith.config.ts" },
    )
    .action((parsed) => {
      setOptions({
        command: "stream",
        configFile: resolve(parsed.config),
      });
    });

  const version = new Command()
    .description("Print the Hooksmith CLI version.")
    .action(() => console.log(VERSION));

  return new Command()
    .name("hooksmith")
    .description("Process events with Hooksmith.")
    .version(VERSION)
    .helpOption("-h, --help", "Show this help.")
    .versionOption("-v, --version", "Print the Hooksmith CLI version.")
    .noExit()
    .command("run", run)
    .command("stream", stream)
    .command("help", new HelpCommand())
    .command("version", version)
    .action(function () {
      this.showHelp();
    });
}
