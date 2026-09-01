# Consuming extensions

Hooksmith does not have a plugin registry or a custom extension loader. A
Hooksmith configuration is an ordinary TypeScript module, so conditions,
listeners, and routes can come from any module source supported by Deno.

## JSR packages

Published extensions can be imported through JSR:

```ts
import { eventType, logEvent } from "jsr:@hooksmith/standard";
```

## Local modules

Project-specific extensions can stay alongside the configuration:

```ts
import { notifyTeam } from "./listeners/notify_team.ts";
```

No publication step is required.

## Remote modules

Modern Deno projects map remote URLs in `deno.json` and import them through a
bare specifier. This lets an extension live in another repository without being
published to JSR:

```json
{
  "imports": {
    "my-hooksmith-extension": "https://raw.githubusercontent.com/example/my-hooksmith-extension/<commit>/mod.ts"
  }
}
```

The Hooksmith configuration then imports the extension normally:

```ts
import {
  logFromExternalExtension,
  metadataEquals,
} from "my-hooksmith-extension";
```

The `hooksmith-test-extension` repository is intentionally unpublished and
exists to exercise this scenario in Hooksmith CI.

For reproducible automation, pin remote imports to an immutable commit or tag
rather than a moving branch such as `master`.

## Import-map aliases

The remote-module example above is also an import-map alias. The same mechanism
can provide friendly names for local modules or other Deno-supported module
sources.

The important boundary is that Hooksmith only receives objects implementing its
`Condition`, `Listener`, and `Route` contracts. It does not need to know how
those objects were loaded.
