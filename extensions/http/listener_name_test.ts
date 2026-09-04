import { assertEquals } from "@std/assert";
import { httpDelete, httpGet, httpPost, httpPut } from "./mod.ts";

Deno.test("HTTP listeners use method-based names by default", () => {
  assertEquals(httpGet({ url: "https://example.test" }).name, "http-get");
  assertEquals(httpPost({ url: "https://example.test" }).name, "http-post");
  assertEquals(httpPut({ url: "https://example.test" }).name, "http-put");
  assertEquals(httpDelete({ url: "https://example.test" }).name, "http-delete");
});

Deno.test("HTTP listeners support custom names", () => {
  assertEquals(
    httpPost({ name: "slack", url: "https://example.test" }).name,
    "slack",
  );
});
