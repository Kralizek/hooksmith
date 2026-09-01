import { assertEquals, assertFalse, assertObjectMatch } from "@std/assert";
import type { Context, Event } from "@hooksmith/core";
import {
  basicAuth,
  bearerAuth,
  headers,
  httpGet,
  httpPost,
  jsonBody,
} from "./mod.ts";

const event: Event = {
  type: "test.event",
  timestamp: Temporal.Instant.from("2026-01-01T00:00:00Z"),
  source: { kind: "test", id: "source" },
  data: { value: 42 },
};

const context: Context = {
  log: {
    debug() {},
    info() {},
    warn() {},
    error() {},
  },
};

Deno.test("httpGet sends a GET request and reports status", async () => {
  await withFetch(async (input, init) => {
    assertEquals(String(input), "https://example.test/resource");
    assertEquals(init?.method, "GET");
    return new Response(null, { status: 204, statusText: "No Content" });
  }, async () => {
    const result = await httpGet({ url: "https://example.test/resource" }).run(event, context);

    assertEquals(result.success, true);
    assertObjectMatch(result.data as Record<string, unknown>, {
      status: 204,
      statusText: "No Content",
    });
  });
});

Deno.test("httpPost resolves auth, headers and JSON body", async () => {
  await withFetch(async (_input, init) => {
    const requestHeaders = new Headers(init?.headers);
    assertEquals(requestHeaders.get("authorization"), "Bearer secret");
    assertEquals(requestHeaders.get("x-event-type"), "test.event");
    assertEquals(requestHeaders.get("content-type"), "application/json");
    assertEquals(init?.body, JSON.stringify({ type: "test.event" }));
    return Response.json({ id: "posted" }, { status: 201 });
  }, async () => {
    const result = await httpPost({
      url: "https://example.test/resource",
      headers: headers(
        bearerAuth("secret"),
        (current) => ({ "X-Event-Type": current.type }),
      ),
      body: jsonBody((current) => ({ type: current.type })),
      expectStatus: 201,
      response: "json",
    }).run(event, context);

    assertEquals(result.success, true);
    assertObjectMatch(result.data as Record<string, unknown>, {
      status: 201,
      body: { id: "posted" },
    });
  });
});

Deno.test("basicAuth creates a basic authorization header", async () => {
  await withFetch(async (_input, init) => {
    const requestHeaders = new Headers(init?.headers);
    assertEquals(requestHeaders.get("authorization"), `Basic ${btoa("user:pass")}`);
    return new Response(null, { status: 200 });
  }, async () => {
    await httpGet({
      url: "https://example.test/resource",
      headers: basicAuth("user", "pass"),
    }).run(event, context);
  });
});

Deno.test("status expectations can fail a listener without throwing", async () => {
  await withFetch(
    () => Promise.resolve(new Response("nope", { status: 409, statusText: "Conflict" })),
    async () => {
      const result = await httpPost({
        url: "https://example.test/resource",
        expectStatus: [200, 201],
        response: "text",
      }).run(event, context);

      assertFalse(result.success);
      assertEquals(result.message, "Unexpected HTTP status 409 Conflict");
      assertObjectMatch(result.data as Record<string, unknown>, {
        status: 409,
        body: "nope",
      });
    },
  );
});

async function withFetch(
  implementation: typeof fetch,
  test: () => Promise<void>,
): Promise<void> {
  const original = globalThis.fetch;
  globalThis.fetch = implementation;
  try {
    await test();
  } finally {
    globalThis.fetch = original;
  }
}
