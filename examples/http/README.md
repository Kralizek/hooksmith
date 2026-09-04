# HTTP example

This example shows Hooksmith using `@hooksmith/http` both before and after
routing.

```text
event
  ↓
getEnrichment
  ↓ adds metadata.tenantPlan
route condition
  ↓ matches tenantPlan = pro
httpPost
  ↓
httpbin.org
```

The configuration first runs a configuration-level `getEnrichment` enricher.
It calls an HTTP endpoint, maps the JSON response to an `EventEnrichment`, and
adds `tenantPlan` to the event metadata.

```ts
getEnrichment<Event, EnrichmentResponse>({
  url: "https://httpbin.org/response-headers?tenantPlan=pro",
  map: (_event, response) => ({
    metadata: { tenantPlan: response.tenantPlan },
  }),
})
```

Configuration-level enrichers run before route conditions. The
`publish-over-http` route can therefore use the newly added metadata when
deciding whether it matches:

```ts
when: all(
  eventType("page.published"),
  metadata("tenantPlan", "pro"),
)
```

When the route matches, `httpPost` sends the event to httpbin. The listener
serializes the event as JSON, expects HTTP 200, parses the JSON response, and
projects the echoed payload into the Hooksmith listener report.

The important part of the example is that the input event does not contain
`tenantPlan`. That value is resolved by the enricher and is available to both
the route condition and the listener afterward.

## Files

- `event.yaml` contains the input event.
- `hooksmith.config.ts` defines the enricher, route condition, and HTTP listener.
- `deno.json` maps the local Hooksmith packages and provides the validation task.

## Validate

From this directory:

```sh
deno task check
```
