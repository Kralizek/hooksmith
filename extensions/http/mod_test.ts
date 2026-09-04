import {
  assertEquals,
  assertFalse,
  assertObjectMatch,
  assertRejects,
  assertThrows,
} from "@std/assert";
import type { Context, Event, TransformContext } from "@hooksmith/core";
import {
  basicAuth,
  bearerAuth,
  expectStatus,
  formBody,
  getJson,
  headers,
  httpDelete,
  httpGet,
  httpPost,
  httpPut,
  jsonBody,
  postJson,
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

const transformContext: TransformContext = {
  ...context,
  originalData: { source: "original" },
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
      response: {
        parse: "json",
        success: expectStatus(201),
      },
    }).run(event, context);

    assertEquals(result.success, true);
    assertObjectMatch(result.data as Record<string, unknown>, {
      status: 201,
      body: { id: "posted" },
    });
  });
});

Deno.test("httpPut and httpDelete use their respective methods", async () => {
  const methods: string[] = [];

  await withFetch((_input, init) => {
    methods.push(init?.method ?? "");
    return Promise.resolve(new Response(null, { status: 204 }));
  }, async () => {
    await httpPut({ url: "https://example.test/resource" }).run(event, context);
    await httpDelete({ url: "https://example.test/resource" }).run(
      event,
      context,
    );
  });

  assertEquals(methods, ["PUT", "DELETE"]);
});

Deno.test("getJson resolves request from transform input and returns JSON body", async () => {
  interface Input {
    id: string;
  }

  interface Output {
    name: string;
  }

  await withFetch((request, init) => {
    assertEquals(String(request), "https://example.test/items/42");
    assertEquals(init?.method, "GET");
    const requestHeaders = new Headers(init?.headers);
    assertEquals(requestHeaders.get("authorization"), "Bearer secret");
    assertEquals(requestHeaders.get("x-original"), "original");
    return Promise.resolve(Response.json({ name: "answer" }));
  }, async () => {
    const transformer = getJson<Input, Output>({
      url: ({ id }) => `https://example.test/items/${id}`,
      headers: headers<Input, TransformContext>(
        bearerAuth<Input, TransformContext>("secret"),
        (_input, currentContext) => ({
          "X-Original": (currentContext.originalData as { source: string })
            .source,
        }),
      ),
    });

    assertEquals(
      await transformer.transform({ id: "42" }, transformContext),
      { name: "answer" },
    );
  });
});

Deno.test("getJson can map input and response into a new output", async () => {
  interface Order {
    orderId: string;
    customerId: string;
  }

  interface Customer {
    name: string;
  }

  interface EnrichedOrder extends Order {
    customer: Customer;
  }

  const input: Order = { orderId: "42", customerId: "7" };

  await withFetch(
    () => Promise.resolve(Response.json({ name: "Ada" })),
    async () => {
      const transformer = getJson<Order, Customer, EnrichedOrder>({
        url: ({ customerId }) => `https://example.test/customers/${customerId}`,
        map: (order, customer) => ({ ...order, customer }),
      });

      assertEquals(await transformer.transform(input, transformContext), {
        ...input,
        customer: { name: "Ada" },
      });
    },
  );
});

Deno.test("postJson posts current transform input as JSON by default", async () => {
  const input = { orderId: "42", amount: 10 };

  await withFetch((_request, init) => {
    assertEquals(init?.method, "POST");
    const requestHeaders = new Headers(init?.headers);
    assertEquals(requestHeaders.get("content-type"), "application/json");
    assertEquals(init?.body, JSON.stringify(input));
    return Promise.resolve(Response.json({ accepted: true }));
  }, async () => {
    const transformer = postJson<typeof input, { accepted: boolean }>({
      url: "https://example.test/orders",
    });

    assertEquals(await transformer.transform(input, transformContext), {
      accepted: true,
    });
  });
});

Deno.test("postJson can project a custom JSON request body", async () => {
  const input = { orderId: "42", amount: 10 };

  await withFetch((_request, init) => {
    assertEquals(init?.body, JSON.stringify({ id: "42" }));
    return Promise.resolve(Response.json({ accepted: true }));
  }, async () => {
    const transformer = postJson<typeof input, { accepted: boolean }>({
      url: "https://example.test/orders",
      body: ({ orderId }: typeof input) => ({ id: orderId }),
    });

    assertEquals(await transformer.transform(input, transformContext), {
      accepted: true,
    });
  });
});

Deno.test("postJson can map input and response into a new output", async () => {
  const input = { orderId: "42", amount: 10 };

  await withFetch(
    () => Promise.resolve(Response.json({ remoteId: "abc" })),
    async () => {
      const transformer = postJson<
        typeof input,
        { remoteId: string },
        typeof input & { remoteId: string }
      >({
        url: "https://example.test/orders",
        map: (order, response) => ({ ...order, remoteId: response.remoteId }),
      });

      assertEquals(await transformer.transform(input, transformContext), {
        ...input,
        remoteId: "abc",
      });
    },
  );
});

Deno.test("JSON transformers reject unsuccessful responses", async () => {
  await withFetch(
    () =>
      Promise.resolve(
        Response.json({ error: "missing" }, {
          status: 404,
          statusText: "Not Found",
        }),
      ),
    async () => {
      const transformer = getJson<unknown, unknown>({
        url: "https://example.test/missing",
      });

      await assertRejects(
        () => Promise.resolve(transformer.transform({}, transformContext)),
        Error,
        "HTTP response considered unsuccessful: 404 Not Found",
      );
    },
  );
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

Deno.test("expectStatus requires at least one status", () => {
  assertThrows(
    () => expectStatus(),
    TypeError,
    "expectStatus requires at least one status code",
  );
});

Deno.test("response shorthand can require an exact status", async () => {
  await withFetch(
    () =>
      Promise.resolve(
        new Response("nope", { status: 409, statusText: "Conflict" }),
      ),
    async () => {
      const result = await httpPost({
        url: "https://example.test/resource",
        response: expectStatus(200, 201),
      }).run(event, context);

      assertFalse(result.success);
      assertEquals(
        result.message,
        "HTTP response considered unsuccessful: 409 Conflict",
      );
    },
  );
});

Deno.test("successMap projects successful responses", async () => {
  await withFetch(
    () => Promise.resolve(Response.json({ id: "post-123", ignored: true })),
    async () => {
      const result = await httpGet({
        url: "https://example.test/resource",
        response: {
          parse: "json",
          successMap: ({ status, body }) => ({
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

Deno.test("errorMap projects failed responses", async () => {
  await withFetch(
    () =>
      Promise.resolve(Response.json({ error: "duplicate" }, { status: 409 })),
    async () => {
      const result = await httpPost({
        url: "https://example.test/resource",
        response: {
          parse: "json",
          errorMap: ({ status, body }) => ({
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

Deno.test("custom response success can override HTTP status semantics", async () => {
  await withFetch(
    () =>
      Promise.resolve(
        Response.json({ result: "already-done" }, { status: 409 }),
      ),
    async () => {
      const result = await httpPost({
        url: "https://example.test/resource",
        response: {
          parse: "json",
          success: ({ body }) =>
            (body as { result: string }).result === "already-done",
          successMap: ({ body }) => ({
            result: (body as { result: string }).result,
          }),
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
