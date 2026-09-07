import { assertEquals } from "@std/assert";
import type { HttpIngressMapper } from "@hooksmith/core/ingress";
import { fromSnsHttp } from "./mod.ts";

Deno.test("fromSnsHttp satisfies HttpIngressMapper", () => {
  const mapper: HttpIngressMapper = fromSnsHttp;
  assertEquals(mapper, fromSnsHttp);
});
