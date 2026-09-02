import { assertStringIncludes } from "@std/assert";
import { usage, VERSION } from "./mod.ts";

Deno.test("generated Cliffy help describes the complete CLI", () => {
  const help = usage();

  assertStringIncludes(help, "hooksmith");
  assertStringIncludes(help, VERSION);
  assertStringIncludes(help, "run");
  assertStringIncludes(help, "stream");
  assertStringIncludes(help, "help");
  assertStringIncludes(help, "version");
  assertStringIncludes(help, "--help");
  assertStringIncludes(help, "--version");
  assertStringIncludes(help, "--allow-empty");
  assertStringIncludes(help, "--format");
});
