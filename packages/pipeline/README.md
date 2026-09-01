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

## Operators

- `project` creates an arbitrary inline `Transformer<A, B>`.
- `parallel` runs multiple transformations concurrently against the same input
  and returns their outputs as a typed tuple.
- `when` conditionally applies a same-type `Transformer<T, T>`.
- `split` projects one value into a homogeneous collection.
- `each` applies one transformation concurrently to every item in a collection.
- `merge()` wraps a tuple or collection as `{ items: ... }` while preserving its
  exact type.
- `pipe` composes transformations and a final listener into a listener for the
  pipeline's original input type.

For example, a collection pipeline can be written as:

```ts
pipe(
  split((page: Page) => page.content.split("\n\n")),
  each(project((section: string) => summarize(section))),
  merge(),
  listener,
);
```

Named transformers are reported by name when they fail. Unnamed transformers are
reported by their one-based position in the pipeline. Transformation failures
become failed `ListenerResult` values; exceptions from the final listener retain
the normal Hooksmith listener behavior.
