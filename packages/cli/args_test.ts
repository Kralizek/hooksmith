import { assertEquals } from "@std/assert";
import { isCommand } from "@optique/discover";
import { main, runCommand, streamCommand } from "./mod.ts";

Deno.test("defines run and stream as Optique commands", () => {
  assertEquals(isCommand(runCommand), true);
  assertEquals(isCommand(streamCommand), true);
});

Deno.test("Optique program handles help and version entry points", async () => {
  assertEquals(await main(["--help"]), 0);
  assertEquals(await main(["-h"]), 0);
  assertEquals(await main(["help"]), 0);
  assertEquals(await main(["--version"]), 0);
  assertEquals(await main(["-v"]), 0);
  assertEquals(await main(["version"]), 0);
});
