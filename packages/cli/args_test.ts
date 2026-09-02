import { assertEquals, assertStringIncludes, assertThrows } from "@std/assert";
import { parseArgs, usage } from "./args.ts";

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
  assertEquals(options.allowEmpty, false);
  assertEquals(options.eventFiles, ["event.yaml", "second.json"]);
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

Deno.test("run supports allow-empty", () => {
  const options = parseArgs(["run", "events/*.json", "--allow-empty"]);
  if (options.command !== "run") throw new Error("Expected run options");

  assertEquals(options.eventFiles, ["events/*.json"]);
  assertEquals(options.allowEmpty, true);
});

Deno.test("parses stream options without an input argument", () => {
  const options = parseArgs(["stream", "-c", "automation/hooksmith.config.ts"]);

  assertEquals(options.command, "stream");
  assertEquals(
    options.configFile.endsWith("automation/hooksmith.config.ts"),
    true,
  );
});

Deno.test("stream rejects bounded-only options", () => {
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
  assertThrows(
    () => parseArgs(["stream", "--allow-empty"]),
    Error,
    "does not support --allow-empty",
  );
});

Deno.test("reports missing option values", () => {
  assertThrows(
    () => parseArgs(["run", "event.yaml", "--format"]),
    Error,
    "--format requires a value",
  );
  assertThrows(
    () => parseArgs(["run", "event.yaml", "-c"]),
    Error,
    "-c requires a path",
  );
});

Deno.test("help describes bounded and streaming modes", () => {
  const help = usage();

  assertStringIncludes(help, "hooksmith --help");
  assertStringIncludes(help, "hooksmith --version");
  assertStringIncludes(
    help,
    "hooksmith run <event-file|glob|-> [event-file|glob...]",
  );
  assertStringIncludes(help, "hooksmith stream [options]");
  assertStringIncludes(help, "-c, --config <path>");
  assertStringIncludes(help, "--allow-empty");
  assertStringIncludes(help, "NDJSON");
});
