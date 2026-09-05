import { assertEquals, assertRejects } from "@std/assert";
import { type Context, type Event, nullLoggerFactory } from "@hooksmith/core";
import { fetchEnrichment, getEnrichment } from "./mod.ts";

const context: Context = {
  logger: nullLoggerFactory,
};

function event(): Event<{ tenantId: string }> {
  return {
    type: "tenant.updated",
    timestamp: Temporal.Instant.from("2026-09-04T11:00:00Z"),
    source: { kind: "test" },
    data: { tenantId: "tenant-42" },
  };
}

Deno.test("getEnrichment fetches JSON and maps it to event enrichment", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (input, init) => {
    assertEquals(String(input), "https://example.test/tenants/tenant-42");
    assertEquals(init?.method, "GET");
    return Promise.resolve(Response.json({ plan: "pro" }));
  };

  try {
    const enricher = getEnrichment<
      Event<{ tenantId: string }>,
      { plan: string }
    >({
      url: ({ data }) => `https://example.test/tenants/${data.tenantId}`,
      map: (_event, response) => ({
        metadata: { tenantPlan: response.plan },
      }),
    });

    assertEquals(await enricher.enrich(event(), context), {
      metadata: { tenantPlan: "pro" },
    });
  } finally {
    globalThis.fetch = original;
  }
});

Deno.test("fetchEnrichment supports arbitrary HTTP methods and JSON bodies", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (_input, init) => {
    assertEquals(init?.method, "POST");
    assertEquals(
      new Headers(init?.headers).get("content-type"),
      "application/json",
    );
    assertEquals(init?.body, JSON.stringify({ tenantId: "tenant-42" }));
    return Promise.resolve(
      Response.json({ metadata: { resolved: true } }),
    );
  };

  try {
    const enricher = fetchEnrichment<Event<{ tenantId: string }>>({
      method: "POST",
      url: "https://example.test/enrich",
      body: (currentEvent: Event<{ tenantId: string }>) => ({
        tenantId: currentEvent.data.tenantId,
      }),
    });

    assertEquals(await enricher.enrich(event(), context), {
      metadata: { resolved: true },
    });
  } finally {
    globalThis.fetch = original;
  }
});

Deno.test("fetchEnrichment reports unsuccessful HTTP responses before parsing JSON", async () => {
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
    const enricher = fetchEnrichment({
      method: "GET",
      url: "https://example.test/enrich",
    });

    await assertRejects(
      () => Promise.resolve(enricher.enrich(event(), context)),
      Error,
      "HTTP response considered unsuccessful: 502 Bad Gateway",
    );
  } finally {
    globalThis.fetch = original;
  }
});
