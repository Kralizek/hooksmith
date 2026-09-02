import { assertEquals, assertStringIncludes } from "@std/assert";
import { usage, VERSION } from "./mod.ts";

Deno.test("generated Cliffy help describes the command surface", () => {
  const help = usage();

  assertStringIncludes(help, "hooksmith");
  assertStringIncludes(help, VERSION);
  assertStringIncludes(help, "run");
  assertStringIncludes(help, "stream");
  assertStringIncludes(help, "help");
  assertStringIncludes(help, "--version");
  assertEquals(help.includes("--help"), false);
});

Deno.test("Cliffy exposes command-only help and option-only version", async () => {
  for (const args of [["help"], ["help", "run"], ["--version"], ["-v"]]) {
    const output = await runCli(args);
    assertEquals(output.code, 0);
  }

  for (const args of [["--help"], ["-h"], ["version"]]) {
    const output = await runCli(args);
    assertEquals(output.code === 0, false);
  }
});

async function runCli(args: string[]): Promise<{ code: number }> {
  const output = await new Deno.Command(Deno.execPath(), {
    args: ["run", "-A", "packages/cli/mod.ts", ...args],
    stdout: "null",
    stderr: "null",
  }).output();

  return { code: output.code };
}
