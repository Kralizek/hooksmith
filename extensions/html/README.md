# @hooksmith/html

HTML parsing and metadata extraction utilities for Hooksmith.

```ts
import { parseOpenGraph } from "@hooksmith/html";

const transformer = parseOpenGraph({
  baseUrl: "https://example.com/article",
});
```

`parseOpenGraph()` transforms an HTML string into typed Open Graph metadata.
When `baseUrl` is provided, relative metadata URLs such as `og:image` and
`og:url` are resolved against it.

The package operates on HTML strings and is independent of how that HTML is
loaded or produced.
