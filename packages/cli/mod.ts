#!/usr/bin/env -S deno run --allow-read --allow-env --allow-net

import type { Config, Context, Event, Logger } from "@hooksmith/core";
import {
  assertEventDocument,
  createRuntime,
  hydrateEvent,
  type Runtime,
} from "@hooksmith/runtime";
import { toFileUrl } from "@std/path";
import cliMetadata from "./deno.json" with { type: "json" };
import { parseArgs, type RunCliOptions, usage } from "./args.ts";
import { loadEventDocuments, resolveInputPaths } from "./input.ts";
import {
  type CliReport,
  createReport,
  type EventExecutionReport,
  type EventInput,
  formatReport,
  inferRoutingOutcome,
  toEventReport,
} from "./report.ts";

export * from "./args.ts";
export * from "./input.ts";
export * from "./report.ts";

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

async function processBounded(
  runtime: Runtime,
  options: RunCliOptions,
): Promise<CliReport> {
  const events: EventExecutionReport[] = [];
  let eventIndex = 0;
  const paths = await resolveInputPaths(options.eventFiles);

  for (const path of paths) {
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
      events.push(
        await processDocument(
          runtime,
          documents[sourceIndex],
          { source, index: eventIndex, sourceIndex: sourceIndex + 1 },
          options.plan,
        ),
      );
    }
  }

  if (events.length === 0 && !options.allowEmpty) {
    events.push(inputFailure(
      { source: "run", index: 1, sourceIndex: 0 },
      new Error("No events were resolved from the supplied inputs."),
    ));
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

export async function loadConfig(path: string): Promise<Config> {
  const module = await import(toFileUrl(path).href);
  if (!("default" in module)) {
    throw new Error("Config module must have a default export.");
  }

  return module.default as Config;
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

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function writeStdout(value: string): Promise<void> {
  await Deno.stdout.write(new TextEncoder().encode(value));
}

if (import.meta.main) {
  Deno.exit(await main(Deno.args));
}
