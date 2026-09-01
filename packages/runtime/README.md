# @hooksmith/runtime

Runtime engine for Hooksmith event hydration, validation, routing, planning,
listener execution, fallback handling, and run reports.

Create a runtime once for the lifetime of a host and process events through it:

```ts
const runtime = createRuntime(config, context);

await runtime.process(firstEvent);
await runtime.process(secondEvent);
```

Use `plan(...)` to evaluate routing and report the listeners that would run
without invoking them:

```ts
const report = await runtime.plan(event);
```

`createRuntime(...)` validates the configuration once and reuses the supplied
context for every processed or planned event. Hosts should keep and reuse the
runtime instance rather than recreating it for each event.
