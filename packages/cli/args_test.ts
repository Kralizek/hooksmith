import { assertEquals, assertStringIncludes } from "@std/assert";
import { VERSION } from "./mod.ts";

Deno.test("Optique program exposes command-only help", async () => {
  for (const args of [["help"], ["help", "run"], ["help", "stream"]]) {
    const output = await runCli(args);
    assertEquals(output.code, 0);
    assertStringIncludes(output.stdout, "hooksmith");
  }

  for (const args of [["--help"], ["-h"]]) {
    const output = await runCli(args);
    assertEquals(output.code === 0, false);
  }
});

Deno.test("Optique program exposes option-only version", async () => {
  for (const args of [["--version"], ["-v"]]) {
    const output = await runCli(args);
    assertEquals(output.code, 0);
    assertStringIncludes(output.stdout, VERSION);
  }

  const command = await runCli(["version"]);
  assertEquals(command.code === 0, false);
});

async function runCli(args: string[]): Promise<{
  code: number;
  stdout: string;
}> {
  const output = await new Deno.Command(Deno.execPath(), {
    args: ["run", "-A", "packages/cli/mod.ts", ...args],
    stdout: "piped",
    stderr: "piped",
  }).output();

  return {
    code: output.code,
    stdout: new TextDecoder().decode(output.stdout),
  };
}
