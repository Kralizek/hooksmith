# @hooksmith/html

HTML parsing and metadata extraction utilities for Hooksmith.

```ts
import { getOpenGraph } from "@hooksmith/html";

const transformer = getOpenGraph({
  url: "https://example.com/article",
});
```

Use `parseOpenGraph()` when HTML is already part of a pipeline, or
`getOpenGraph()` to fetch a page through `@hooksmith/http` and extract its Open
Graph metadata in one transformation.
