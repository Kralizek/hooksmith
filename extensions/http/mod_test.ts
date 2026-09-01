import { assertEquals, assertFalse, assertObjectMatch } from "@std/assert";
import type { Context, Event } from "@hooksmith/core";
import {
  basicAuth,
  bearerAuth,
  formBody,
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
  await withFetch((input, init) => {
    assertEquals(String(input), "https://example.test/resource");
    assertEquals(init?.method, "GET");
    return Promise.resolve(
      new Response(null, { status: 204, statusText: "No Content" }),
    );
  }, async () => {
    const result = await httpGet({ url: "https://example.test/resource" }).run(
      event,
      context,
    );

    assertEquals(result.success, true);
    assertObjectMatch(result.data as Record<string, unknown>, {
      status: 204,
      statusText: "No Content",
    });
  });
});

Deno.test("httpPost resolves auth, headers and JSON body", async () => {
  await withFetch((_input, init) => {
    const requestHeaders = new Headers(init?.headers);
    assertEquals(requestHeaders.get("authorization"), "Bearer secret");
    assertEquals(requestHeaders.get("x-event-type"), "test.event");
    assertEquals(requestHeaders.get("content-type"), "application/json");
    assertEquals(init?.body, JSON.stringify({ type: "test.event" }));
    return Promise.resolve(Response.json({ id: "posted" }, { status: 201 }));
  }, async () => {
    const result = await httpPost({
      url: "https://example.test/resource",
      headers: headers(
        bearerAuth("secret"),
        (current) => ({ "X-Event-Type": current.type }),
      ),
      body: jsonBody((current: Event) => ({ type: current.type })),
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

Deno.test("formBody encodes URL form data", async () => {
  await withFetch((_input, init) => {
    const requestHeaders = new Headers(init?.headers);
    assertEquals(
      requestHeaders.get("content-type"),
      "application/x-www-form-urlencoded",
    );
    assertEquals(init?.body, "grant_type=client_credentials&scope=write");
    return Promise.resolve(new Response(null, { status: 200 }));
  }, async () => {
    await httpPost({
      url: "https://example.test/token",
      body: formBody({ grant_type: "client_credentials", scope: "write" }),
    }).run(event, context);
  });
});

Deno.test("basicAuth creates a basic authorization header", async () => {
  await withFetch((_input, init) => {
    const requestHeaders = new Headers(init?.headers);
    assertEquals(
      requestHeaders.get("authorization"),
      `Basic ${btoa("user:pass")}`,
    );
    return Promise.resolve(new Response(null, { status: 200 }));
  }, async () => {
    await httpGet({
      url: "https://example.test/resource",
      headers: basicAuth("user", "pass"),
    }).run(event, context);
  });
});

Deno.test("status expectations can fail a listener without throwing", async () => {
  await withFetch(
    () =>
      Promise.resolve(
        new Response("nope", { status: 409, statusText: "Conflict" }),
      ),
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

Deno.test("response mapper projects successful responses", async () => {
  await withFetch(
    () => Promise.resolve(Response.json({ id: "post-123", ignored: true })),
    async () => {
      const result = await httpGet({
        url: "https://example.test/resource",
        response: {
          body: "json",
          map: ({ status, body }) => ({
            status,
            id: (body as { id: string }).id,
          }),
        },
      }).run(event, context);

      assertEquals(result.success, true);
      assertEquals(result.data, { status: 200, id: "post-123" });
    },
  );
});

Deno.test("response error mapper projects failed responses", async () => {
  await withFetch(
    () =>
      Promise.resolve(Response.json({ error: "duplicate" }, { status: 409 })),
    async () => {
      const result = await httpPost({
        url: "https://example.test/resource",
        response: {
          body: "json",
          mapError: ({ status, body }) => ({
            status,
            error: (body as { error: string }).error,
          }),
        },
      }).run(event, context);

      assertFalse(result.success);
      assertEquals(result.data, { status: 409, error: "duplicate" });
    },
  );
});

Deno.test("response success predicate can override HTTP status semantics", async () => {
  await withFetch(
    () =>
      Promise.resolve(
        Response.json({ result: "already-done" }, { status: 409 }),
      ),
    async () => {
      const result = await httpPost({
        url: "https://example.test/resource",
        expectStatus: 201,
        response: {
          body: "json",
          isSuccess: ({ body }) =>
            (body as { result: string }).result === "already-done",
          map: ({ body }) => ({ result: (body as { result: string }).result }),
        },
      }).run(event, context);

      assertEquals(result.success, true);
      assertEquals(result.data, { result: "already-done" });
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
