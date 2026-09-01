import { assertEquals, assertStringIncludes, assertThrows } from "@std/assert";
import type { RunReport } from "@hooksmith/runtime";
import { formatReport, loadEventDocument, parseArgs, usage } from "./mod.ts";

Deno.test("parses run options", () => {
  const options = parseArgs([
    "run",
    "event.yaml",
    "--config",
    "automation/hooksmith.config.ts",
    "--format",
    "json",
    "--plan",
  ]);

  assertEquals(options.format, "json");
  assertEquals(options.plan, true);
  assertEquals(options.eventFile.endsWith("event.yaml"), true);
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

Deno.test("preserves - as stdin input", () => {
  const options = parseArgs(["run", "-"]);

  assertEquals(options.eventFile, "-");
});

Deno.test("loads event document from stdin input", async () => {
  const document = await loadEventDocument(
    "-",
    () =>
      Promise.resolve(
        '{"type":"page.published","source":{"kind":"website"},"data":{}}',
      ),
  ) as Record<string, unknown>;

  assertEquals(document.type, "page.published");
});

Deno.test("rejects more than one event file", () => {
  assertThrows(
    () => parseArgs(["run", "one.yaml", "two.yaml"]),
    Error,
    "exactly one event file",
  );
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

Deno.test("help describes supported shorthand and stdin", () => {
  const help = usage();

  assertStringIncludes(help, "hooksmith --help");
  assertStringIncludes(help, "hooksmith -h");
  assertStringIncludes(help, "hooksmith --version");
  assertStringIncludes(help, "hooksmith -v");
  assertStringIncludes(help, "-c, --config <path>");
  assertStringIncludes(help, "read exactly one event from stdin");
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

Deno.test("formats fallback report as tsv", () => {
  const report: RunReport = {
    mode: "run",
    event: {
      type: "page.published",
      timestamp: "2026-08-31T20:00:00Z",
      source: { kind: "website", id: "example.com" },
    },
    results: [{
      route: "fallback",
      listener: "log-unhandled",
      status: "success",
      message: "Unhandled event recorded",
    }],
    success: true,
  };

  assertEquals(
    formatReport(report, "tsv"),
    "route\tlistener\tstatus\tmessage\nfallback\tlog-unhandled\tsuccess\tUnhandled event recorded",
  );
});
