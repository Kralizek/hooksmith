# hooksmith

Hooksmith is a small, generic event routing runtime for Deno. It reads one event document, evaluates configured routes in declaration order, and invokes listeners for every matching route.

The project deliberately keeps event production outside the runtime. A static-site pipeline, a release workflow, a deployment system, or any other producer can serialize an event as YAML or JSON and hand it to Hooksmith.

## Status

Hooksmith is at the beginning of its design and implementation. The initial packages use lockstep `0.1.0` versions and the public API should be considered experimental.

## Repository

```text
packages/
  core/       Public contracts for extension authors
  runtime/    Validation, routing, execution, planning, and reports
  cli/        Event loading, config discovery, formatting, and process behavior
extensions/
  web/        Reserved for first-party web extensions
  aws/        Reserved for first-party AWS extensions
actions/
  hooksmith/  Reserved for the first-party GitHub Action
examples/
  basic/      Minimal event and configuration example
```

The dependency direction is intentionally one-way: `core <- runtime <- cli`.

## Event model

An in-memory event uses `Temporal.Instant` for its timestamp:

```ts
import type { Event } from "@hooksmith/core";

const event: Event = {
  type: "page.published",
  timestamp: Temporal.Instant.from("2026-08-31T20:00:00Z"),
  source: {
    kind: "website",
    id: "example.com",
  },
  subject: {
    kind: "page",
    id: "/hello",
  },
  metadata: {
    url: "https://example.com/hello",
  },
  data: {
    title: "Hello, Hooksmith",
  },
};
```

The serialized `EventDocument` uses a string timestamp and can be represented as YAML or JSON.

## Configuration

Hooksmith loads `./hooksmith.config.ts` from the current working directory by default. Configuration is ordinary TypeScript and can import reusable listeners, conditions, and routes through Deno's module system.

```ts
import type { Config } from "@hooksmith/core";

export default {
  routes: [
    {
      name: "published-pages",
      when: {
        name: "is-page-published",
        evaluate: (event) => event.type === "page.published",
      },
      listeners: [
        {
          name: "log-publication",
          run(event, { log }) {
            log.info(`Published ${event.subject?.id}`);
            return { success: true };
          },
        },
      ],
    },
  ],
} satisfies Config;
```

An event can match multiple routes. Routes and listeners execute sequentially in configuration order. If no route matches, optional fallback listeners execute instead.

A condition that throws is an unrecoverable routing error and aborts the run. Listener failures are collected while later listeners continue to run; the process still exits with code `1` if any listener fails.

## CLI

```text
hooksmith run <event-file> [--config <path>] [--format table|json|tsv] [--plan]
```

Only one event document is processed per invocation. `.yaml`, `.yml`, and `.json` are supported.

`--plan` evaluates routing and reports the listeners that would run without invoking them.

The report is written to stdout. All logs and diagnostics are written to stderr, so machine-readable output can be redirected safely:

```sh
deno run -A jsr:@hooksmith/cli run event.yaml --format json > report.json
```

The default report format is `table`.

## Development

Hooksmith tracks the latest stable Deno 2.x release in CI.

```sh
deno task check
```

## License

MIT
