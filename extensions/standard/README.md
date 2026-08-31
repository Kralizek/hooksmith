# @hooksmith/standard

Standard, dependency-free building blocks for Hooksmith configuration.

The package depends only on `@hooksmith/core` and provides generic conditions,
condition composition, and a simple event-logging listener.

## Conditions

```ts
import { all, eventType, sourceKind, subjectKind } from "@hooksmith/standard";

const publishedWebPage = all(
  eventType("page.published"),
  sourceKind("website"),
  subjectKind("page"),
);
```

Available matchers are `eventType`, `sourceKind`, `sourceId`, `subjectKind`, and
`subjectId`. Conditions can be composed with `all`, `any`, and `not`.

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
