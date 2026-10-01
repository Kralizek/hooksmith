import { assertEquals, assertRejects } from "@std/assert";
import type { Context, TransformContext } from "@hooksmith/core";
import { nullLoggerFactory } from "@hooksmith/runtime";
import { fetchText, getText } from "./mod.ts";

const context: Context = {
  logger: nullLoggerFactory,
};

const transformContext: TransformContext = {
  ...context,
  originalData: { source: "original" },
};

Deno.test("getText fetches a text response", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (input, init) => {
    assertEquals(String(input), "https://example.test/page");
    assertEquals(init?.method, "GET");
    return Promise.resolve(new Response("<html>Hello</html>"));
  };

  try {
    const transformer = getText<unknown>({
      url: "https://example.test/page",
    });

    assertEquals(
      await transformer.transform({}, transformContext),
      "<html>Hello</html>",
    );
  } finally {
    globalThis.fetch = original;
  }
});

Deno.test("fetchText supports arbitrary methods, bodies, and mapping", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (_input, init) => {
    assertEquals(init?.method, "POST");
    assertEquals(init?.body, "request");
    return Promise.resolve(new Response("response"));
  };

  try {
    const transformer = fetchText<string, { input: string; response: string }>({
      method: "POST",
      url: "https://example.test/page",
      body: (input) => input,
      map: (input, response) => ({ input, response }),
    });

    assertEquals(
      await transformer.transform("request", transformContext),
      { input: "request", response: "response" },
    );
  } finally {
    globalThis.fetch = original;
  }
});

Deno.test("text transformers reject unsuccessful responses", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = () =>
    Promise.resolve(
      new Response("missing", {
        status: 404,
        statusText: "Not Found",
      }),
    );

  try {
    const transformer = getText<unknown>({
      url: "https://example.test/missing",
    });

    await assertRejects(
      () => Promise.resolve(transformer.transform({}, transformContext)),
      Error,
      "HTTP response considered unsuccessful: 404 Not Found",
    );
  } finally {
    globalThis.fetch = original;
  }
});
