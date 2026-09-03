# @hooksmith/pipeline

Typed listener-side data transformation pipelines for Hooksmith.

A pipeline transforms only `Event.data`. The original event envelope is
preserved for the final listener, and every transformation receives a
`TransformContext` whose `originalData` points to the data that entered the
pipeline.

```ts
import type { Event, Listener } from "@hooksmith/core";
import {
  parallel,
  pipe,
  project,
} from "@hooksmith/pipeline";

interface Page {
  title: string;
  content: string;
}

interface Announcement {
  text: string;
  imagePrompt: string;
}

const bluesky: Listener<Event<Announcement>> = /* ... */;

const listener = pipe(
  parallel(
    project((page: Page) => generatePostText(page)),
    project((page: Page) => generateImagePrompt(page)),
  ),
  project(([text, imagePrompt]) => ({ text, imagePrompt })),
  bluesky,
);
```

`pipe` validates the full type sequence at compile time and returns an ordinary
Hooksmith listener, so the runtime does not need to know that transformations
exist.

Pipelines have their own stable listener identity. By default, `pipe(...)`
generates `pipe:<terminal-listener-name>` (or `pipe:listener` for an unnamed
terminal listener). An explicit name can be supplied when a domain-specific
identity is clearer:

```ts
pipe(
  { name: "publish-announcement" },
  project((page: Page) => createAnnouncement(page)),
  bluesky,
);
```

The pipeline name is the listener identity reported by the runtime regardless of
whether the terminal listener ultimately runs.

## Operators

- `project` creates an arbitrary inline `Transformer<A, B>`.
- `tap` performs a side effect while preserving the current pipeline value. It
  accepts either a void/`Promise<void>` callback or a Hooksmith listener.
- `parallel` runs multiple transformations concurrently against the same input
  and returns their outputs as a typed tuple.
- `when` conditionally applies a same-type `Transformer<T, T>`.
- `match` selects the first matching `caseOf(...)` branch and otherwise uses the
  required final `otherwise(...)` branch. All branches share the same input and
  output types.
- `split` projects one value into a homogeneous collection.
- `each` applies a transformer or listener concurrently to every item in a
  collection. With a transformer, the pipeline continues with the collected
  outputs. With a listener, `each` becomes the terminal fan-out listener.
- `merge()` wraps a tuple or collection as `{ items: ... }` while preserving its
  exact type.
- `pipe` composes transformations and a final listener into a listener for the
  pipeline's original input type.

A tap can run an inline side effect without affecting downstream types:

```ts
pipe(
  project((page: Page) => createAnnouncement(page)),
  tap((announcement) => audit(announcement)),
  bluesky,
);
```

An existing listener can also be tapped. The listener receives the original
event envelope with the current pipeline value as `data`; its returned data is
ignored and the original value continues downstream. An unsuccessful listener
result fails the transformation.

```ts
pipe(
  project((page: Page) => createAnnouncement(page)),
  tap(slack),
  bluesky,
);
```

Conditional branching can be expressed with `match(...)`. Cases are evaluated in
declaration order and only the first matching transformer runs:

```ts
pipe(
  match(
    caseOf(
      (message: Message) => message.kind === "email",
      project((message: Message) => toEmailPayload(message)),
    ),
    caseOf(
      (message: Message) => message.kind === "sms",
      project((message: Message) => toSmsPayload(message)),
    ),
    otherwise(
      project((message: Message) => toGenericPayload(message)),
    ),
  ),
  listener,
);
```

The first `caseOf(...)` establishes the input and output contract for the match.
Every later case and `otherwise(...)` must use compatible types, so downstream
pipeline stages continue to see one stable output type.

For example, a collection transformation pipeline can be written as:

```ts
pipe(
  split((page: Page) => page.content.split("\n\n")),
  each(project((section: string) => summarize(section))),
  merge(),
  listener,
);
```

A split collection can fan out directly into a listener, or continue through
per-item transformations before fan-out.

```ts
pipe(
  split((page: Page) => page.content.split("\n\n")),
  each(listener),
);
```

Here, `split` produces a collection and `each(listener)` invokes the listener
once for every item.

You can also transform every item before invoking the listener:

```ts
pipe(
  split((page: Page) => page.content.split("\n\n")),
  each(project((section: string) => summarize(section))),
  each(listener),
);
```

This composes as:

```text
Page
→ string[]
→ Summary[]
→ one listener invocation per Summary
```

Both `each(transformer)` and `each(listener)` process collection items
concurrently. A fan-out listener aggregates all returned `ListenerResult`
values, and the aggregate succeeds only when every invocation succeeds. Listener
exceptions retain normal Hooksmith listener behavior.

Named transformers are reported by name when they fail. Unnamed transformers are
reported by their one-based position in the pipeline. Transformation failures
become failed `ListenerResult` values; exceptions from the final listener retain
the normal Hooksmith listener behavior.
