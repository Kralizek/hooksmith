# @hooksmith/cli

Command-line interface for loading Hooksmith event documents and configuration,
running or planning an event, and rendering reports.

## Usage

```text
hooksmith --help | -h
hooksmith --version | -v
hooksmith run <event-file|-> [options]
```

Run options:

```text
-c, --config <path>          Config file (default: hooksmith.config.ts)
    --format table|json|tsv  Report format (default: table)
    --plan                   Plan the event without invoking listeners
```

Use `-` as the event input to read exactly one event from stdin:

```sh
cat event.json | hooksmith run - -c hooksmith.config.ts
```
