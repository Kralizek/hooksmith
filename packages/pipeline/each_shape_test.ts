import { assertEquals } from "@std/assert";
import { nullLoggerFactory } from "@hooksmith/runtime";
import type { Transformer } from "./mod.ts";
import { each } from "./mod.ts";

Deno.test("each prefers transformer semantics for structurally ambiguous operations", async () => {
  let runCalled = false;
  const operation: Transformer<string, number> & { run(): never } = {
    transform(value) {
      return value.length;
    },
    run() {
      runCalled = true;
      throw new Error("run should not be called");
    },
  };

  const transformer = each(operation);
  const result = await transformer.transform(["one", "three"], {
    logger: nullLoggerFactory,
    originalData: "original",
  });

  assertEquals(result, [3, 5]);
  assertEquals(runCalled, false);
});
