import { assertEquals } from "@std/assert";
import { main } from "./mod.ts";

Deno.test("Optique program handles help and version entry points", async () => {
  assertEquals(await main(["--help"]), 0);
  assertEquals(await main(["-h"]), 0);
  assertEquals(await main(["help"]), 0);
  assertEquals(await main(["--version"]), 0);
  assertEquals(await main(["-v"]), 0);
  assertEquals(await main(["version"]), 0);
});
