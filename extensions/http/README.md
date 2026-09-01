# @hooksmith/http

HTTP listeners and request helpers for Hooksmith.

## Listeners

- `httpRequest` sends an HTTP request with an arbitrary method.
- `httpGet` sends a GET request.
- `httpPost` sends a POST request.

All request values that commonly depend on the current event can be provided as
either constants or factories.

```ts
import {
  bearerAuth,
  expectStatus,
  headers,
  httpPost,
  jsonBody,
} from "@hooksmith/http";

const listener = httpPost({
  url: "https://example.com/webhook",
  headers: headers(
    bearerAuth(Deno.env.get("TOKEN")!),
    (event) => ({ "X-Event-Type": event.type }),
  ),
  body: jsonBody((event) => event.data),
  response: expectStatus(202),
});
```

By default, any `2xx` response is considered successful. For a different success
condition, set `response` directly to a predicate such as `expectStatus(...)`.

```ts
httpPost({
  url: "https://example.com/posts",
  body: jsonBody({ title: "Hello" }),
  response: expectStatus(201),
});
```

The listener always returns the response status, status text, and headers in
`ListenerResult.data`, making them available in Hooksmith reports.

For response parsing, custom success semantics, or report projection, use the
object form:

```ts
const listener = httpPost({
  url: "https://example.com/posts",
  body: jsonBody((event) => event.data),
  response: {
    parse: "json",
    success: ({ status, body }) =>
      status === 201 ||
      (status === 409 &&
        (body as { result?: string }).result === "already-done"),
    successMap: ({ status, body }) => ({
      status,
      id: (body as { id?: string }).id,
    }),
    errorMap: ({ status, body }) => ({
      status,
      error: (body as { error?: string }).error,
    }),
  },
});
```

`parse` controls whether the response body is read as `"text"`, `"json"`, or
not parsed at all. If omitted, the body is not read.

`success` defines whether the response should be treated as successful. If it
is omitted, the normal HTTP `2xx` rule applies. `expectStatus(...)` is a helper
for the common exact-status case and can be used either directly as `response`
or as `response.success`.

`successMap` projects successful responses before they are written to
`ListenerResult.data`. `errorMap` does the same for failed responses. If the
relevant mapper is omitted, the complete HTTP response report is returned.

## Helpers

- `headers(...)` combines static and event-derived header sources.
- `bearerAuth(...)` adds a Bearer authorization header.
- `basicAuth(...)` adds an HTTP Basic authorization header.
- `jsonBody(...)` serializes a value and sets `Content-Type: application/json`
  unless already specified.
- `formBody(...)` URL-encodes form values and sets
  `Content-Type: application/x-www-form-urlencoded` unless already specified.
- `textBody(...)` creates a text body with a configurable content type.
- `expectStatus(...)` creates a response-success predicate for one or more
  accepted HTTP status codes.
