# @hooksmith/runtime

Runtime engine for Hooksmith event hydration, validation, routing, planning,
listener execution, fallback handling, and run reports.

Use `runEvent(...)` for one-shot execution, or create a reusable runtime when a
host processes multiple events:

```ts
const runtime = createRuntime(config, context);

await runtime.process(firstEvent);
await runtime.process(secondEvent);
```

`createRuntime(...)` validates the configuration once and reuses the supplied
context for every processed event.
