import { assertEquals, assertThrows } from "@std/assert";
import { parseArgs } from "./mod.ts";

Deno.test("run supports allow-empty", () => {
  const options = parseArgs(["run", "events/*.json", "--allow-empty"]);
  if (options.command !== "run") throw new Error("Expected run options");

  assertEquals(options.eventFiles, ["events/*.json"]);
  assertEquals(options.allowEmpty, true);
});

Deno.test("stream does not support allow-empty", () => {
  assertThrows(
    () => parseArgs(["stream", "--allow-empty"]),
    Error,
    "does not support --allow-empty",
  );
});
