# hooksmith

Hooksmith is a small, generic event-processing toolkit for Deno. It hydrates event documents, evaluates configured routes, and invokes listeners for every matching route. Around that runtime, the ecosystem adds typed listener-side pipelines, reusable conditions and HTTP listeners, command-line and streaming hosts, a GitHub Action, and provider-specific extensions.

The project deliberately keeps event production outside the runtime. A static-site pipeline, a release workflow, a deployment system, an AWS event source, or any other producer can serialize or adapt an event and hand it to Hooksmith.

## Status

Hooksmith is at the beginning of its design and implementation. The packages are versioned together and the public API should be considered experimental.

## Package family

The Hooksmith packages are versioned and released together.

| Package | Latest | Downloads | Purpose |
| --- | --- | --- | --- |
| [`@hooksmith/core`](https://jsr.io/@hooksmith/core) | [![latest](https://jsr.io/badges/@hooksmith/core)](https://jsr.io/@hooksmith/core) | [![downloads](https://jsr.io/badges/@hooksmith/core/total-downloads)](https://jsr.io/@hooksmith/core) | Public contracts for events, routes, conditions, listeners, execution context, and listener results. |
| [`@hooksmith/pipeline`](https://jsr.io/@hooksmith/pipeline) | [![latest](https://jsr.io/badges/@hooksmith/pipeline)](https://jsr.io/@hooksmith/pipeline) | [![downloads](https://jsr.io/badges/@hooksmith/pipeline/total-downloads)](https://jsr.io/@hooksmith/pipeline) | Typed listener-side data transformations and composition helpers. |
| [`@hooksmith/runtime`](https://jsr.io/@hooksmith/runtime) | [![latest](https://jsr.io/badges/@hooksmith/runtime)](https://jsr.io/@hooksmith/runtime) | [![downloads](https://jsr.io/badges/@hooksmith/runtime/total-downloads)](https://jsr.io/@hooksmith/runtime) | Event hydration, validation, routing, planning, listener execution, fallback handling, and run reports. |
| [`@hooksmith/cli`](https://jsr.io/@hooksmith/cli) | [![latest](https://jsr.io/badges/@hooksmith/cli)](https://jsr.io/@hooksmith/cli) | [![downloads](https://jsr.io/badges/@hooksmith/cli/total-downloads)](https://jsr.io/@hooksmith/cli) | Command-line interface for bounded multi-event runs, NDJSON streaming, planning, and reports. |
| [`@hooksmith/standard`](https://jsr.io/@hooksmith/standard) | [![latest](https://jsr.io/badges/@hooksmith/standard)](https://jsr.io/@hooksmith/standard) | [![downloads](https://jsr.io/badges/@hooksmith/standard/total-downloads)](https://jsr.io/@hooksmith/standard) | Standard generic conditions, condition composition, and basic listeners for authoring Hooksmith configuration. |
| [`@hooksmith/http`](https://jsr.io/@hooksmith/http) | [![latest](https://jsr.io/badges/@hooksmith/http)](https://jsr.io/@hooksmith/http) | [![downloads](https://jsr.io/badges/@hooksmith/http/total-downloads)](https://jsr.io/@hooksmith/http) | HTTP request listeners plus helpers for headers, authentication, request bodies, status assertions, response mapping, and reporting. |

For extension authors, `@hooksmith/core` is the primary dependency. Applications invoking Hooksmith from the command line normally use `@hooksmith/cli`. `@hooksmith/pipeline` provides listener-side transformation composition without depending on the runtime engine. `@hooksmith/standard` provides reusable configuration building blocks without depending on the runtime engine, while `@hooksmith/http` provides protocol-level HTTP listeners that provider-specific extensions can build on.

## External extensions

Provider-specific extensions can live in separate repositories and follow their own release cadence.

| Package | Latest | Downloads | Repository | Purpose |
| --- | --- | --- | --- | --- |
| [`@hooksmith/aws`](https://jsr.io/@hooksmith/aws) | [![latest](https://jsr.io/badges/@hooksmith/aws)](https://jsr.io/@hooksmith/aws) | [![downloads](https://jsr.io/badges/@hooksmith/aws/total-downloads)](https://jsr.io/@hooksmith/aws) | [`aws`](https://github.com/Kralizek/hooksmith-aws) | AWS event adapters, service listeners, and pipeline transformers. |
| [`@hooksmith/aws-lambda`](https://jsr.io/@hooksmith/aws-lambda) | [![latest](https://jsr.io/badges/@hooksmith/aws-lambda)](https://jsr.io/@hooksmith/aws-lambda) | [![downloads](https://jsr.io/badges/@hooksmith/aws-lambda/total-downloads)](https://jsr.io/@hooksmith/aws-lambda) | [`aws`](https://github.com/Kralizek/hooksmith-aws) | AWS Lambda hosting support for Hooksmith runtimes. |
| [`@hooksmith/bluesky`](https://jsr.io/@hooksmith/bluesky) | [![latest](https://jsr.io/badges/@hooksmith/bluesky)](https://jsr.io/@hooksmith/bluesky) | [![downloads](https://jsr.io/badges/@hooksmith/bluesky/total-downloads)](https://jsr.io/@hooksmith/bluesky) | [`social`](https://github.com/Kralizek/hooksmith-social) | Publish posts to Bluesky using an account identifier and app password. |
| [`@hooksmith/discord`](https://jsr.io/@hooksmith/discord) | [![latest](https://jsr.io/badges/@hooksmith/discord)](https://jsr.io/@hooksmith/discord) | [![downloads](https://jsr.io/badges/@hooksmith/discord/total-downloads)](https://jsr.io/@hooksmith/discord) | [`notifications`](https://github.com/Kralizek/hooksmith-notifications) | Send messages through Discord webhooks. |
| [`@hooksmith/mastodon`](https://jsr.io/@hooksmith/mastodon) | [![latest](https://jsr.io/badges/@hooksmith/mastodon)](https://jsr.io/@hooksmith/mastodon) | [![downloads](https://jsr.io/badges/@hooksmith/mastodon/total-downloads)](https://jsr.io/@hooksmith/mastodon) | [`social`](https://github.com/Kralizek/hooksmith-social) | Publish statuses to Mastodon-compatible instances using a user access token. |
| [`@hooksmith/slack`](https://jsr.io/@hooksmith/slack) | [![latest](https://jsr.io/badges/@hooksmith/slack)](https://jsr.io/@hooksmith/slack) | [![downloads](https://jsr.io/badges/@hooksmith/slack/total-downloads)](https://jsr.io/@hooksmith/slack) | [`notifications`](https://github.com/Kralizek/hooksmith-notifications) | Send messages through the Slack Web API. |
| [`@hooksmith/teams`](https://jsr.io/@hooksmith/teams) | [![latest](https://jsr.io/badges/@hooksmith/teams)](https://jsr.io/@hooksmith/teams) | [![downloads](https://jsr.io/badges/@hooksmith/teams/total-downloads)](https://jsr.io/@hooksmith/teams) | [`notifications`](https://github.com/Kralizek/hooksmith-notifications) | Send messages through Microsoft Teams Workflows webhooks. |

## Repository

```text
packages/
  core/       Public contracts for extension authors
  pipeline/   Typed listener-side transformation pipelines
  runtime/    Validation, routing, execution, planning, and reports
  cli/        Bounded runs, streaming, config discovery, and report formatting
extensions/
  standard/   Generic conditions, composition, and basic listeners
  http/       HTTP request listeners and request/response helpers
action.yml    Primary Hooksmith GitHub Action
actions/      Reserved for future specialized actions
examples/
  basic/                   Minimal event and configuration example
  pipeline/                Listener-side transformation composition
  http/                    HTTP listener and response mapping
  external-extensions/     Isolated external JSR extensions
  remote-extension/        Unpublished remote extension integration
  aws-sqs-slack-lambda/    SQS -> Hooksmith -> Slack Lambda example
```

The main runtime dependency direction is intentionally one-way: `core <- runtime <- cli`. The pipeline, standard, and HTTP packages depend only on `core`.

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
import {
  all,
  data,
  eventType,
  logEvent,
  metadata,
  sourceKind,
} from "@hooksmith/standard";

interface PageData {
  title: string;
}

export default {
  routes: [
    {
      name: "published-pages",
      when: all(
        eventType("page.published"),
        sourceKind("website"),
        data<PageData>((value) => value.title.length > 0),
        metadata("environment", "production"),
      ),
      listeners: [logEvent()],
    },
  ],
} satisfies Config;
```

`@hooksmith/standard` also provides `sourceId`, `subjectKind`, `subjectId`, `any`, and `not`. `metadata` can compare a value directly or evaluate a predicate, and `data` can evaluate synchronous or asynchronous predicates over event data. See [`extensions/standard`](extensions/standard) for more examples.

An event can match multiple routes. Routes and listeners execute sequentially in configuration order. If no route matches, optional fallback listeners execute instead.

A condition that throws is an unrecoverable routing error and aborts the run. Listener failures are collected while later listeners continue to run; the process still exits with code `1` if any listener fails.

## Pipeline

`@hooksmith/pipeline` composes typed transformations into an ordinary Hooksmith listener. The runtime remains unaware of the pipeline internals.

Current operators include `project`, `tap`, `parallel`, `when`, `match`, `split`, `each`, and `merge`. `each(listener)` provides terminal fan-out, while `tap(listener)` invokes a listener as a side effect and keeps the current value flowing downstream.

See [`packages/pipeline`](packages/pipeline) for detailed examples and type semantics.

## GitHub Action

GitHub Actions workflows can run Hooksmith without installing Deno explicitly:

```yaml
- id: hooksmith
  uses: Kralizek/hooksmith@v0
  with:
    event: .hooksmith/event.yaml
```

`event` is required. `config` defaults to `hooksmith.config.ts`, `plan` defaults to `false`, and `report-path` is optional.

The Action always writes the complete JSON run report to a file. When `report-path` is omitted, the report is written under the runner temporary directory at `${{ runner.temp }}/hooksmith/report.json`. Relative custom report paths are resolved from the caller workspace, absolute paths are preserved, and parent directories are created automatically.

The Action exposes three small outputs instead of embedding the full report in GitHub output data:

- `success` — whether the Hooksmith run succeeded.
- `mode` — `run` or `plan`.
- `report-path` — absolute path to the JSON report file.

For example:

```yaml
- name: Inspect Hooksmith report
  run: jq . "${{ steps.hooksmith.outputs.report-path }}"
```

The Action installs Deno and invokes the exact `@hooksmith/cli` version corresponding to the Action release. Paths are resolved from the caller's workspace, so the same event documents, configuration modules, and Deno import mappings used by direct CLI execution continue to work.

## CLI

```text
hooksmith help [command]
hooksmith --version
hooksmith -v
hooksmith run <event-file|glob|-> [event-file|glob...] [options]
hooksmith stream [options]
```

`run` accepts one or more YAML/JSON files, glob patterns, and `-` for bounded stdin. Each input may contain one event, an array of events, or multiple YAML documents. Inputs are flattened and processed sequentially through one reusable runtime instance.

```sh
hooksmith run first.yaml second.json -c hooksmith.config.ts
hooksmith run "events/**/*.json" -c hooksmith.config.ts
cat events.yaml | hooksmith run - --format json
```

Bounded runs support `--plan`, `--format table|json|tsv`, and `--allow-empty`.

`stream` reads NDJSON from stdin and emits one compact NDJSON report per non-empty line:

```sh
producer | hooksmith stream -c hooksmith.config.ts
```

Event-level failures are reported and streaming continues; process-level failures remain fatal. See [`packages/cli`](packages/cli) for the full command contract.

## Extensions

Hooksmith configuration can consume extension modules from JSR, local files, remote repositories, or import-map aliases. See [`docs/extensions.md`](docs/extensions.md) for the supported patterns and the CI-backed unpublished-extension example.

The examples directory includes isolated provider extensions, remote unpublished extensions, HTTP and pipeline samples, and an end-to-end SQS-to-Slack Lambda composition.

## Development

Hooksmith tracks the latest stable Deno 2.x release in CI.

```sh
deno task check
```

## License

MIT
