#!/usr/bin/env -S deno run --allow-read --allow-env --allow-net

import type { Config, Context, Logger } from "@hooksmith/core";
import {
  assertConfig,
  assertEventDocument,
  hydrateEvent,
  runEvent,
  type RunReport,
} from "@hooksmith/runtime";
import { extname, resolve, toFileUrl } from "@std/path";
import { parse as parseYaml } from "@std/yaml";

export type ReportFormat = "table" | "json" | "tsv";

export interface CliOptions {
  eventFile: string;
  configFile: string;
  format: ReportFormat;
  plan: boolean;
}

export async function main(args: string[]): Promise<number> {
  try {
    const options = parseArgs(args);
    const eventDocument = await loadEventDocument(options.eventFile);
    assertEventDocument(eventDocument);
    const event = hydrateEvent(eventDocument);
    const config = await loadConfig(options.configFile);
    const context: Context = { log: stderrLogger };
    const report = await runEvent(event, config, context, {
      plan: options.plan,
    });

    await writeStdout(`${formatReport(report, options.format)}\n`);
    return report.success ? 0 : 1;
  } catch (error) {
    stderrLogger.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

export function parseArgs(args: string[]): CliOptions {
  if (args.length === 0 || args[0] !== "run") {
    throw new Error(usage());
  }

  let eventFile: string | undefined;
  let configFile = "hooksmith.config.ts";
  let format: ReportFormat = "table";
  let plan = false;

  for (let index = 1; index < args.length; index++) {
    const argument = args[index];

    switch (argument) {
      case "--config": {
        const value = args[++index];
        if (value === undefined) {
          throw new Error("--config requires a path.");
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
      default:
        if (argument.startsWith("--")) {
          throw new Error(`Unknown option: ${argument}`);
        }
        if (eventFile !== undefined) {
          throw new Error("run accepts exactly one event file.");
        }
        eventFile = argument;
        break;
    }
  }

  if (eventFile === undefined) {
    throw new Error("run requires an event file.");
  }

  return {
    eventFile: resolve(eventFile),
    configFile: resolve(configFile),
    format,
    plan,
  };
}

export async function loadEventDocument(path: string): Promise<unknown> {
  const content = await Deno.readTextFile(path);

  switch (extname(path).toLowerCase()) {
    case ".yaml":
    case ".yml":
      return parseYaml(content, { schema: "core" });
    case ".json":
      return JSON.parse(content);
    default:
      throw new Error("Event file must use .yaml, .yml, or .json.");
  }
}

export async function loadConfig(path: string): Promise<Config> {
  const module = await import(toFileUrl(path).href);
  if (!("default" in module)) {
    throw new Error("Config module must have a default export.");
  }

  assertConfig(module.default);
  return module.default;
}

export function formatReport(report: RunReport, format: ReportFormat): string {
  switch (format) {
    case "json":
      return JSON.stringify(report, undefined, 2);
    case "tsv":
      return formatTsv(report);
    case "table":
      return formatTable(report);
  }
}

function formatTable(report: RunReport): string {
  const rows = report.results.map((result) => [
    result.route,
    result.listener,
    result.status,
    result.message ?? "",
  ]);

  const headers = ["Route", "Listener", "Status", "Message"];
  const widths = headers.map((header, index) =>
    Math.max(header.length, ...rows.map((row) => row[index].length))
  );

  const line = (row: string[]) =>
    row.map((cell, index) => cell.padEnd(widths[index])).join("  ").trimEnd();

  const output = [
    `Event: ${report.event.type}`,
    `Mode: ${report.mode}`,
    `Success: ${report.success}`,
    "",
    line(headers),
    line(widths.map((width) => "-".repeat(width))),
    ...rows.map(line),
  ];

  return output.join("\n");
}

function formatTsv(report: RunReport): string {
  const header = ["route", "listener", "status", "message"].join("\t");
  const rows = report.results.map((result) =>
    [
      result.route,
      result.listener,
      result.status,
      result.message ?? "",
    ].map(tsvCell).join("\t")
  );

  return [header, ...rows].join("\n");
}

function tsvCell(value: string): string {
  return value.replace(/[\t\r\n]+/g, " ");
}

function usage(): string {
  return "Usage: hooksmith run <event-file> [--config <path>] [--format table|json|tsv] [--plan]";
}

const stderrLogger: Logger = {
  debug: (message, ...args) => logToStderr("DEBUG", message, args),
  info: (message, ...args) => logToStderr("INFO", message, args),
  warn: (message, ...args) => logToStderr("WARN", message, args),
  error: (message, ...args) => logToStderr("ERROR", message, args),
};

function logToStderr(level: string, message: string, args: unknown[]): void {
  const suffix = args.length === 0
    ? ""
    : ` ${args.map(renderLogValue).join(" ")}`;
  console.error(`[${level}] ${message}${suffix}`);
}

function renderLogValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

async function writeStdout(value: string): Promise<void> {
  await Deno.stdout.write(new TextEncoder().encode(value));
}

if (import.meta.main) {
  Deno.exit(await main(Deno.args));
}
