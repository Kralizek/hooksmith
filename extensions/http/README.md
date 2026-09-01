# @hooksmith/http

HTTP listeners and request helpers for Hooksmith.

## Listeners

- `httpRequest` sends an HTTP request with an arbitrary method.
- `httpGet` sends a GET request.
- `httpPost` sends a POST request.

All request values that commonly depend on the current event can be provided as
either constants or factories.

```ts
import { bearerAuth, headers, httpPost, jsonBody } from "@hooksmith/http";

const listener = httpPost({
  url: "https://example.com/webhook",
  headers: headers(
    bearerAuth(Deno.env.get("TOKEN")!),
    (event) => ({ "X-Event-Type": event.type }),
  ),
  body: jsonBody((event) => event.data),
  expectStatus: 202,
  response: "json",
});
```

By default, any `2xx` response is considered successful. `expectStatus` can be a
status code, a list of allowed codes, or a predicate.

The listener always returns the response status, status text, and headers in
`ListenerResult.data`, making them available in Hooksmith reports. Set
`response` to `"text"` or `"json"` to include the response body as well.

For more control, use the object form of `response`:

```ts
const listener = httpPost({
  url: "https://example.com/posts",
  body: jsonBody((event) => event.data),
  expectStatus: 201,
  response: {
    body: "json",
    isSuccess: ({ status, body }) =>
      status === 201 ||
      (status === 409 &&
        (body as { result?: string }).result === "already-done"),
    map: ({ status, body }) => ({
      status,
      id: (body as { id?: string }).id,
    }),
    mapError: ({ status, body }) => ({
      status,
      error: (body as { error?: string }).error,
    }),
  },
});
```

`isSuccess` overrides the normal status-based success decision. If it is not
provided, `expectStatus` is used; if neither is provided, any `2xx` response is
successful.

`map` projects successful responses before they are written to
`ListenerResult.data`. `mapError` does the same for failed responses. If the
relevant mapper is omitted, the complete HTTP response report is returned.
Mapping never changes the success decision; only `isSuccess` can override it.

## Helpers

- `headers(...)` combines static and event-derived header sources.
- `bearerAuth(...)` adds a Bearer authorization header.
- `basicAuth(...)` adds an HTTP Basic authorization header.
- `jsonBody(...)` serializes a value and sets `Content-Type: application/json`
  unless already specified.
- `formBody(...)` URL-encodes form values and sets
  `Content-Type: application/x-www-form-urlencoded` unless already specified.
- `textBody(...)` creates a text body with a configurable content type.
