import { assertEquals, assertStringIncludes } from "@std/assert";
import { VERSION } from "./mod.ts";

Deno.test("Optique program handles help entry points", async () => {
  for (const argument of ["--help", "-h", "help"]) {
    const output = await runCli(argument);
    assertEquals(output.code, 0);
    assertStringIncludes(output.stdout, "hooksmith run");
    assertStringIncludes(output.stdout, "hooksmith stream");
  }
});

Deno.test("Optique program handles version entry points", async () => {
  for (const argument of ["--version", "-v", "version"]) {
    const output = await runCli(argument);
    assertEquals(output.code, 0);
    assertStringIncludes(output.stdout, VERSION);
  }
});

async function runCli(argument: string): Promise<{
  code: number;
  stdout: string;
}> {
  const output = await new Deno.Command(Deno.execPath(), {
    args: ["run", "-A", "packages/cli/mod.ts", argument],
    stdout: "piped",
    stderr: "piped",
  }).output();

  return {
    code: output.code,
    stdout: new TextDecoder().decode(output.stdout),
  };
}
