# @hooksmith/standard

Standard, dependency-free building blocks for Hooksmith configuration.

The package depends only on `@hooksmith/core` and provides generic conditions,
condition composition, and a simple event-logging listener.

## Conditions

```ts
import {
  all,
  data,
  eventType,
  metadata,
  sourceKind,
  subjectKind,
} from "@hooksmith/standard";

interface PageData {
  title: string;
}

const publishedWebPage = all(
  eventType("page.published"),
  sourceKind("website"),
  subjectKind("page"),
  data<PageData>((value) => value.title.length > 0),
  metadata("environment", "production"),
  metadata(
    "url",
    (value) => typeof value === "string" && value.startsWith("https://"),
  ),
);
```

Available matchers are `eventType`, `sourceKind`, `sourceId`, `subjectKind`,
`subjectId`, `data`, and `metadata`. Conditions can be composed with `all`,
`any`, and `not`.

`data` accepts synchronous or asynchronous predicates over the event payload.
`metadata` supports either strict value comparison or a synchronous/asynchronous
predicate over a metadata value. A metadata condition does not match when the
requested key is absent.

When a configuration is explicitly typed as `Config<Event<TData>>`, TypeScript
can infer the payload type for `data(...)` from that surrounding configuration.

## Listener

```ts
import { logEvent } from "@hooksmith/standard";

const listeners = [
  logEvent(),
  logEvent("warn"),
];
```

`logEvent` writes the event through the Hooksmith execution context logger and
returns a successful listener result.
