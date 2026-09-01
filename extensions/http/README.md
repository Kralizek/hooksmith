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

## Helpers

- `headers(...)` combines static and event-derived header sources.
- `bearerAuth(...)` adds a Bearer authorization header.
- `basicAuth(...)` adds an HTTP Basic authorization header.
- `jsonBody(...)` serializes a value and sets `Content-Type: application/json`
  unless already specified.
- `formBody(...)` URL-encodes form values and sets
  `Content-Type: application/x-www-form-urlencoded` unless already specified.
- `textBody(...)` creates a text body with a configurable content type.
