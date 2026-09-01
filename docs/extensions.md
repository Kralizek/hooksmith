# Consuming extensions

Hooksmith does not have a plugin registry or a custom extension loader. A Hooksmith configuration is an ordinary TypeScript module, so conditions, listeners, and routes can come from any module source supported by Deno.

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

Extensions can also be consumed directly from another repository without being published to JSR:

```ts
import {
  logFromExternalExtension,
  metadataEquals,
} from "https://raw.githubusercontent.com/Kralizek/hooksmith-test-extension/ceae29a9e8fdb7507e32eed1b87171a4c602c2b2/mod.ts";
```

The `hooksmith-test-extension` repository is intentionally unpublished and exists to exercise this scenario in Hooksmith CI.

For reproducible automation, pin remote imports to an immutable commit or tag rather than a moving branch such as `master`.

## Import-map aliases

Because module loading belongs to Deno rather than Hooksmith, consumers can also map a friendly name to any of these sources through their Deno configuration and import that alias from `hooksmith.config.ts`.

The important boundary is that Hooksmith only receives objects implementing its `Condition`, `Listener`, and `Route` contracts. It does not need to know how those objects were loaded.
