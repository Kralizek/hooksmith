import { assertEquals, assertRejects } from "@std/assert";
import type { Context, TransformContext } from "@hooksmith/core";
import { nullLoggerFactory } from "@hooksmith/runtime";
import { fetchJson } from "./mod.ts";

const context: Context = {
  logger: nullLoggerFactory,
};

const transformContext: TransformContext = {
  ...context,
  originalData: { source: "original" },
};

Deno.test("fetchJson supports arbitrary HTTP methods and JSON bodies", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (_input, init) => {
    assertEquals(init?.method, "PATCH");
    assertEquals(
      new Headers(init?.headers).get("content-type"),
      "application/json",
    );
    assertEquals(init?.body, JSON.stringify({ enabled: true }));
    return Promise.resolve(Response.json({ updated: true }));
  };

  try {
    const transformer = fetchJson<
      { id: string },
      { updated: boolean },
      { id: string; updated: boolean }
    >({
      method: "PATCH",
      url: ({ id }) => `https://example.test/items/${id}`,
      body: { enabled: true },
      map: (input, response) => ({ ...input, updated: response.updated }),
    });

    assertEquals(
      await transformer.transform({ id: "42" }, transformContext),
      { id: "42", updated: true },
    );
  } finally {
    globalThis.fetch = original;
  }
});

Deno.test("fetchJson does not send a body unless configured", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (_input, init) => {
    assertEquals(init?.method, "DELETE");
    assertEquals(init?.body, undefined);
    return Promise.resolve(Response.json({ deleted: true }));
  };

  try {
    const transformer = fetchJson<string, { deleted: boolean }>({
      method: "DELETE",
      url: (id) => `https://example.test/items/${id}`,
    });

    assertEquals(await transformer.transform("42", transformContext), {
      deleted: true,
    });
  } finally {
    globalThis.fetch = original;
  }
});

Deno.test("fetchJson reports unsuccessful HTTP responses before parsing JSON", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = () =>
    Promise.resolve(
      new Response("upstream failure", {
        status: 502,
        statusText: "Bad Gateway",
        headers: { "content-type": "text/plain" },
      }),
    );

  try {
    const transformer = fetchJson<unknown, unknown>({
      method: "GET",
      url: "https://example.test/items/42",
    });

    await assertRejects(
      () => Promise.resolve(transformer.transform({}, transformContext)),
      Error,
      "HTTP response considered unsuccessful: 502 Bad Gateway",
    );
  } finally {
    globalThis.fetch = original;
  }
});
