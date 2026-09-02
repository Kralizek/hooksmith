import { assertEquals, assertStringIncludes, assertThrows } from "@std/assert";
import {
  type CliReport,
  formatReport,
  loadEventDocument,
  loadEventDocuments,
  parseArgs,
  usage,
} from "./mod.ts";

Deno.test("parses bounded run options", () => {
  const options = parseArgs([
    "run",
    "event.yaml",
    "second.json",
    "--config",
    "automation/hooksmith.config.ts",
    "--format",
    "json",
    "--plan",
  ]);

  if (options.command !== "run") throw new Error("Expected run options");
  assertEquals(options.format, "json");
  assertEquals(options.plan, true);
  assertEquals(options.eventFiles.length, 2);
  assertEquals(options.eventFiles[0].endsWith("event.yaml"), true);
  assertEquals(options.eventFiles[1].endsWith("second.json"), true);
  assertEquals(
    options.configFile.endsWith("automation/hooksmith.config.ts"),
    true,
  );
});

Deno.test("parses -c as config shorthand", () => {
  const options = parseArgs([
    "run",
    "event.json",
    "-c",
    "automation/hooksmith.config.ts",
  ]);

  assertEquals(
    options.configFile.endsWith("automation/hooksmith.config.ts"),
    true,
  );
});

Deno.test("preserves stdin in an input chain", () => {
  const options = parseArgs(["run", "one.json", "-", "two.json"]);

  if (options.command !== "run") throw new Error("Expected run options");
  assertEquals(options.eventFiles[1], "-");
});

Deno.test("rejects stdin more than once", () => {
  assertThrows(
    () => parseArgs(["run", "-", "-"]),
    Error,
    "stdin at most once",
  );
});

Deno.test("parses stream options without an input argument", () => {
  const options = parseArgs(["stream", "-c", "automation/hooksmith.config.ts"]);

  assertEquals(options.command, "stream");
  assertEquals(
    options.configFile.endsWith("automation/hooksmith.config.ts"),
    true,
  );
});

Deno.test("stream does not support plan or report format options", () => {
  assertThrows(
    () => parseArgs(["stream", "--plan"]),
    Error,
    "does not support --plan",
  );
  assertThrows(
    () => parseArgs(["stream", "--format", "json"]),
    Error,
    "does not support --format",
  );
});

Deno.test("loads one event document from bounded stdin", async () => {
  const document = await loadEventDocument(
    "-",
    () =>
      Promise.resolve(
        '{"type":"page.published","source":{"kind":"website"},"data":{}}',
      ),
  ) as Record<string, unknown>;

  assertEquals(document.type, "page.published");
});

Deno.test("flattens JSON arrays into event documents", async () => {
  const documents = await loadEventDocuments(
    "events.json",
    () => Promise.resolve('[{"type":"one"},{"type":"two"}]'),
  ) as Record<string, unknown>[];

  assertEquals(documents.map((document) => document.type), ["one", "two"]);
});

Deno.test("flattens YAML documents and arrays in source order", async () => {
  const documents = await loadEventDocuments(
    "events.yaml",
    () => Promise.resolve("---\ntype: one\n---\n- type: two\n- type: three\n"),
  ) as Record<string, unknown>[];

  assertEquals(documents.map((document) => document.type), [
    "one",
    "two",
    "three",
  ]);
});

Deno.test("reports a missing --format value", () => {
  assertThrows(
    () => parseArgs(["run", "event.yaml", "--format"]),
    Error,
    "--format requires a value",
  );
});

Deno.test("reports a missing -c value", () => {
  assertThrows(
    () => parseArgs(["run", "event.yaml", "-c"]),
    Error,
    "-c requires a path",
  );
});

Deno.test("help describes bounded and streaming modes", () => {
  const help = usage();

  assertStringIncludes(help, "hooksmith --help");
  assertStringIncludes(help, "hooksmith -h");
  assertStringIncludes(help, "hooksmith --version");
  assertStringIncludes(help, "hooksmith -v");
  assertStringIncludes(help, "hooksmith run <event-file|-> [event-file...]");
  assertStringIncludes(help, "hooksmith stream [options]");
  assertStringIncludes(help, "-c, --config <path>");
  assertStringIncludes(help, "NDJSON");
});

Deno.test("loads YAML timestamps as strings", async () => {
  const path = await Deno.makeTempFile({ suffix: ".yaml" });

  try {
    await Deno.writeTextFile(
      path,
      "type: page.published\ntimestamp: 2026-08-31T20:00:00Z\nsource:\n  kind: website\ndata: {}\n",
    );

    const document = await loadEventDocument(path) as Record<string, unknown>;
    assertEquals(document.timestamp, "2026-08-31T20:00:00Z");
  } finally {
    await Deno.remove(path);
  }
});

Deno.test("formats fallback events as flattened tsv rows", () => {
  const report: CliReport = {
    mode: "run",
    events: [{
      input: { source: "events.yaml", index: 1, sourceIndex: 1 },
      event: {
        type: "page.published",
        timestamp: "2026-08-31T20:00:00Z",
        source: { kind: "website", id: "example.com" },
      },
      outcome: "fallback",
      results: [{
        route: "fallback",
        listener: "log-unhandled",
        status: "success",
        message: "Unhandled event recorded",
      }],
      success: true,
    }],
    success: true,
  };

  assertEquals(
    formatReport(report, "tsv"),
    "event\tinput\tsource_index\tevent_type\toutcome\troute\tlistener\tstatus\tmessage\n1\tevents.yaml\t1\tpage.published\tfallback\tfallback\tlog-unhandled\tsuccess\tUnhandled event recorded",
  );
});

Deno.test("formats unmatched events even without listener results", () => {
  const report: CliReport = {
    mode: "run",
    events: [{
      input: { source: "events.yaml", index: 1, sourceIndex: 1 },
      event: {
        type: "page.deleted",
        timestamp: "2026-08-31T20:00:00Z",
        source: { kind: "website", id: "example.com" },
      },
      outcome: "unmatched",
      results: [],
      success: true,
    }],
    success: true,
  };

  assertStringIncludes(formatReport(report, "table"), "unmatched");
});
