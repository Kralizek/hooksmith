# @hooksmith/core

Core contracts for Hooksmith events, routes, conditions, listeners, execution
context, listener results, and logging.

The execution `Context` exposes a `LoggerFactory`. Components obtain a logger
bound to their source and emit structured log entries using message templates,
optional properties, and an optional error value.

```ts
const log = context.logger.getLogger("ExampleListener:publish");

log.debug(
  "Publishing event {eventType}",
  { eventType: event.type },
);
```

`Logger` exposes `trace`, `debug`, `info`, `warn`, and `error`. `LogLevel` is
derived from those methods so APIs that accept a log level stay aligned with
the logger contract.
