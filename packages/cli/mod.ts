#!/usr/bin/env -S deno run --allow-read --allow-env --allow-net

import type { Config, Context, Event, Logger } from "@hooksmith/core";
import {
  assertEventDocument,
  createRuntime,
  hydrateEvent,
  type EventReport,
  type ListenerReport,
  type RoutingOutcome,
  type RunReport as RuntimeRunReport,
  type Runtime,
} from "@hooksmith/runtime";
import { extname, resolve, toFileUrl } from "@std/path";
import { parseAll as parseAllYaml } from "@std/yaml";
import cliMetadata from "./deno.json" with { type: "json" };

export type ReportFormat = "table" | "json" | "tsv";

export interface RunCliOptions {
  command: "run";
  eventFiles: string[];
  configFile: string;
  format: ReportFormat;
  plan: boolean;
}

export interface StreamCliOptions {
  command: "stream";
  configFile: string;
}

export type CliOptions = RunCliOptions | StreamCliOptions;

export interface EventInput {
  source: string;
  index: number;
  sourceIndex: number;
}

export interface EventError {
  stage: "input" | "runtime";
  message: string;
}

export type EventOutcome = RoutingOutcome | "rejected" | "failed";

export interface EventExecutionReport {
  input: EventInput;
  event?: EventReport;
  outcome: EventOutcome;
  results: ListenerReport[];
  success: boolean;
  error?: EventError;
}

export interface CliReport {
  mode: "run" | "plan";
  events: EventExecutionReport[];
  success: boolean;
}

export const VERSION = cliMetadata.version;

export async function main(args: string[]): Promise<number> {
  try {
    if (args.length === 1 && (args[0] === "--help" || args[0] === "-h")) {
      await writeStdout(`${usage()}\n`);
      return 0;
    }

    if (args.length === 1 && (args[0] === "--version" || args[0] === "-v")) {
      await writeStdout(`${VERSION}\n`);
      return 0;
    }

    const options = parseArgs(args);
    const config = await loadConfig(options.configFile);
    const context: Context = { log: stderrLogger };
    const runtime = createRuntime(config, context);

    if (options.command === "stream") {
      return await processStream(runtime);
    }

    const report = await processBounded(runtime, options);
    await writeStdout(`${formatReport(report, options.format)}\n`);
    return report.success ? 0 : 1;
  } catch (error) {
    stderrLogger.error(errorMessage(error));
    return 1;
  }
}

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
      default:
        if (argument.startsWith("-") && argument !== "-") {
          throw new Error(`Unknown option: ${argument}`);
        }
        eventFiles.push(argument === "-" ? "-" : resolve(argument));
        break;
    }
  }

  if (eventFiles.length === 0) {
    throw new Error("run requires at least one event file or - for stdin.");
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
        throw new Error("stream output is always NDJSON and does not support --format.");
      default:
        throw new Error(`Unknown stream option: ${argument}`);
    }
  }

  return { command: "stream", configFile: resolve(configFile) };
}

async function processBounded(
  runtime: Runtime,
  options: RunCliOptions,
): Promise<CliReport> {
  const events: EventExecutionReport[] = [];
  let eventIndex = 0;

  for (const path of options.eventFiles) {
    const source = inputSource(path);
    let documents: unknown[];

    try {
      documents = await loadEventDocuments(path);
    } catch (error) {
      eventIndex++;
      events.push(inputFailure(
        { source, index: eventIndex, sourceIndex: 1 },
        error,
      ));
      continue;
    }

    for (let sourceIndex = 0; sourceIndex < documents.length; sourceIndex++) {
      eventIndex++;
      events.push(await processDocument(
        runtime,
        documents[sourceIndex],
        { source, index: eventIndex, sourceIndex: sourceIndex + 1 },
        options.plan,
      ));
    }
  }

  return createReport(options.plan ? "plan" : "run", events);
}

async function processStream(runtime: Runtime): Promise<number> {
  let eventIndex = 0;
  let lineNumber = 0;

  for await (const line of readLines(Deno.stdin.readable)) {
    lineNumber++;
    if (line.trim().length === 0) {
      continue;
    }

    eventIndex++;
    const input: EventInput = {
      source: "stdin",
      index: eventIndex,
      sourceIndex: lineNumber,
    };

    let eventReport: EventExecutionReport;
    try {
      eventReport = await processDocument(
        runtime,
        JSON.parse(line),
        input,
        false,
      );
    } catch (error) {
      eventReport = inputFailure(input, error);
    }

    const report = createReport("run", [eventReport]);
    await writeStdout(`${JSON.stringify(report)}\n`);
  }

  return 0;
}

async function processDocument(
  runtime: Runtime,
  document: unknown,
  input: EventInput,
  plan: boolean,
): Promise<EventExecutionReport> {
  let event: Event;

  try {
    assertEventDocument(document);
    event = hydrateEvent(document);
  } catch (error) {
    return inputFailure(input, error);
  }

  try {
    const report = plan
      ? await runtime.plan(event)
      : await runtime.process(event);

    return {
      input,
      event: report.event,
      outcome: report.outcome ?? inferRoutingOutcome(report),
      results: report.results,
      success: report.success,
    };
  } catch (error) {
    return {
      input,
      event: toEventReport(event),
      outcome: "failed",
      results: [],
      success: false,
      error: { stage: "runtime", message: errorMessage(error) },
    };
  }
}

function inputFailure(input: EventInput, error: unknown): EventExecutionReport {
  return {
    input,
    outcome: "rejected",
    results: [],
    success: false,
    error: { stage: "input", message: errorMessage(error) },
  };
}

function createReport(
  mode: "run" | "plan",
  events: EventExecutionReport[],
): CliReport {
  return {
    mode,
    events,
    success: events.every((event) => event.success),
  };
}

export async function loadEventDocuments(
  path: string,
  readContent: (path: string) => Promise<string> = readEventContent,
): Promise<unknown[]> {
  const content = await readContent(path);
  let documents: unknown[];

  if (path === "-") {
    documents = parseAllYaml(content, { schema: "core" });
  } else {
    switch (extname(path).toLowerCase()) {
      case ".yaml":
      case ".yml":
        documents = parseAllYaml(content, { schema: "core" });
        break;
      case ".json":
        documents = [JSON.parse(content)];
        break;
      default:
        throw new Error("Event file must use .yaml, .yml, or .json.");
    }
  }

  return documents.flatMap((document) =>
    Array.isArray(document) ? document : [document]
  );
}

export async function loadEventDocument(
  path: string,
  readContent: (path: string) => Promise<string> = readEventContent,
): Promise<unknown> {
  const documents = await loadEventDocuments(path, readContent);
  return documents.length === 1 ? documents[0] : documents;
}

async function readEventContent(path: string): Promise<string> {
  if (path === "-") {
    return await new Response(Deno.stdin.readable).text();
  }

  return await Deno.readTextFile(path);
}

export async function loadConfig(path: string): Promise<Config> {
  const module = await import(toFileUrl(path).href);
  if (!("default" in module)) {
    throw new Error("Config module must have a default export.");
  }

  return module.default as Config;
}

export function formatReport(
  report: CliReport | RuntimeRunReport,
  format: ReportFormat,
): string {
  const normalized = "events" in report ? report : fromRuntimeReport(report);

  switch (format) {
    case "json":
      return JSON.stringify(normalized, undefined, 2);
    case "tsv":
      return formatTsv(normalized);
    case "table":
      return formatTable(normalized);
  }
}

function formatTable(report: CliReport): string {
  const output = [
    `Mode: ${report.mode}`,
    `Success: ${report.success}`,
  ];

  for (const event of report.events) {
    output.push(
      "",
      `Event #${event.input.index}: ${event.event?.type ?? "invalid"}`,
      `Input: ${event.input.source} #${event.input.sourceIndex}`,
      `Outcome: ${event.outcome}`,
      `Success: ${event.success}`,
      "",
    );

    const rows = resultRows(event);
    const headers = ["Route", "Listener", "Status", "Outcome", "Message"];
    const widths = headers.map((header, index) =>
      Math.max(header.length, ...rows.map((row) => row[index].length))
    );
    const line = (row: string[]) =>
      row.map((cell, index) => cell.padEnd(widths[index])).join("  ")
        .trimEnd();

    output.push(
      line(headers),
      line(widths.map((width) => "-".repeat(width))),
      ...rows.map(line),
    );
  }

  return output.join("\n");
}

function formatTsv(report: CliReport): string {
  const header = [
    "event",
    "input",
    "source_index",
    "event_type",
    "outcome",
    "route",
    "listener",
    "status",
    "message",
  ].join("\t");
  const rows: string[] = [];

  for (const event of report.events) {
    for (const row of resultRows(event)) {
      rows.push([
        String(event.input.index),
        event.input.source,
        String(event.input.sourceIndex),
        event.event?.type ?? "",
        row[3],
        row[0],
        row[1],
        row[2],
        row[4],
      ].map(tsvCell).join("\t"));
    }
  }

  return [header, ...rows].join("\n");
}

function resultRows(event: EventExecutionReport): string[][] {
  if (event.results.length === 0) {
    return [[
      event.outcome === "unmatched" ? "unmatched" :
      event.outcome === "fallback" ? "fallback" : "",
      "",
      event.success ? "success" : "failure",
      event.outcome,
      event.error?.message ?? "",
    ]];
  }

  return event.results.map((result) => [
    result.route,
    result.listener,
    result.status,
    listenerOutcome(event, result),
    result.message ?? "",
  ]);
}

function listenerOutcome(
  event: EventExecutionReport,
  result: ListenerReport,
): string {
  if (result.status === "planned") {
    return "planned";
  }
  if (event.outcome === "fallback") {
    return "fallback";
  }
  if (isRecord(result.data)) {
    const pipeline = result.data.pipeline;
    if (isRecord(pipeline) && typeof pipeline.outcome === "string") {
      return pipeline.outcome;
    }
    if (result.data.stage === "transform") {
      return "transform-failed";
    }
  }
  return "executed";
}

function fromRuntimeReport(report: RuntimeRunReport): CliReport {
  const event: EventExecutionReport = {
    input: { source: "event", index: 1, sourceIndex: 1 },
    event: report.event,
    outcome: report.outcome ?? inferRoutingOutcome(report),
    results: report.results,
    success: report.success,
  };
  return createReport(report.mode, [event]);
}

function inferRoutingOutcome(report: RuntimeRunReport): RoutingOutcome {
  if (report.results.some((result) => result.route === "fallback")) {
    return "fallback";
  }
  return report.results.length === 0 ? "unmatched" : "matched";
}

function toEventReport(event: Event): EventReport {
  return {
    type: event.type,
    timestamp: event.timestamp.toString(),
    source: event.source,
    subject: event.subject,
    metadata: event.metadata,
  };
}

function inputSource(path: string): string {
  return path === "-" ? "stdin" : path;
}

async function* readLines(
  stream: ReadableStream<Uint8Array>,
): AsyncIterable<string> {
  const reader = stream.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;

      let newline: number;
      while ((newline = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, newline).replace(/\r$/, "");
        buffer = buffer.slice(newline + 1);
        yield line;
      }
    }

    if (buffer.length > 0) {
      yield buffer.replace(/\r$/, "");
    }
  } finally {
    reader.releaseLock();
  }
}

function tsvCell(value: string): string {
  return value.replace(/[\t\r\n]+/g, " ");
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
    "  hooksmith run <event-file|-> [event-file...] [options]",
    "  hooksmith stream [options]",
    "",
    "Run options:",
    "  -c, --config <path>          Config file (default: hooksmith.config.ts)",
    "      --format table|json|tsv  Report format (default: table)",
    "      --plan                   Plan events without invoking listeners",
    "",
    "Stream options:",
    "  -c, --config <path>          Config file (default: hooksmith.config.ts)",
    "",
    "run accepts YAML/JSON files and bounded stdin. Each source may contain one",
    "event, an array of events, or multiple YAML documents.",
    "stream reads NDJSON from stdin and emits one NDJSON report per event.",
  ].join("\n");
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function writeStdout(value: string): Promise<void> {
  await Deno.stdout.write(new TextEncoder().encode(value));
}

if (import.meta.main) {
  Deno.exit(await main(Deno.args));
}
