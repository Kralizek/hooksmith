import { assertEquals, assertThrows } from "@std/assert";
import type { RunReport } from "@hooksmith/runtime";
import { formatReport, parseArgs } from "./mod.ts";

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

Deno.test("rejects more than one event file", () => {
  assertThrows(
    () => parseArgs(["run", "one.yaml", "two.yaml"]),
    Error,
    "exactly one event file",
  );
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
