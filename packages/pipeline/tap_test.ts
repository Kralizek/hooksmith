import { assertEquals } from "@std/assert";
import type { Context, Event, Listener } from "@hooksmith/core";
import { nullLoggerFactory } from "@hooksmith/runtime";
import { pipe, project, tap, type Transformer } from "./mod.ts";

const context: Context = { logger: nullLoggerFactory };

const event: Event<string> = {
  type: "message.ready",
  timestamp: Temporal.Instant.from("2026-09-03T10:00:00Z"),
  source: { kind: "test", id: "source" },
  subject: { kind: "message", id: "message-1" },
  metadata: { environment: "test" },
  data: "hooksmith",
};

Deno.test("tap runs a synchronous side effect and preserves the input", async () => {
  const seen: string[] = [];
  const transformation = tap((value: string) => {
    seen.push(value);
  }, "capture");

  const result = await transformation.transform("hooksmith", {
    ...context,
    originalData: "hooksmith",
  });

  assertEquals(transformation.name, "capture");
  assertEquals(result, "hooksmith");
  assertEquals(seen, ["hooksmith"]);
});

Deno.test("tap awaits an asynchronous side effect", async () => {
  const seen: string[] = [];
  const transformation = tap(async (value: string) => {
    await Promise.resolve();
    seen.push(value);
  });

  assertEquals(
    await transformation.transform("hooksmith", {
      ...context,
      originalData: "hooksmith",
    }),
    "hooksmith",
  );
  assertEquals(seen, ["hooksmith"]);
});

Deno.test("tap invokes a listener with the current value and original envelope", async () => {
  let received: Event<number> | undefined;
  const sideEffect: Listener<Event<number>> = {
    name: "observe-length",
    run(current) {
      received = current;
      return { success: true, data: "ignored" };
    },
  };
  const terminal: Listener<Event<number>> = {
    run(current) {
      return { success: true, data: current.data };
    },
  };

  const result = await pipe(
    project((value: string) => value.length),
    tap(sideEffect),
    terminal,
  ).run(event, context);

  assertEquals(result, { success: true, data: 9 });
  assertEquals(received, { ...event, data: 9 });
});

Deno.test("tap turns an unsuccessful listener result into a transformation failure", async () => {
  const sideEffect: Listener<Event<string>> = {
    name: "publish",
    run() {
      return { success: false, message: "unavailable" };
    },
  };
  const terminal: Listener<Event<string>> = {
    run() {
      return { success: true };
    },
  };

  const result = await pipe(tap(sideEffect), terminal).run(event, context);

  assertEquals(result, {
    success: false,
    message: 'Transformation "publish" failed: unavailable',
    data: {
      stage: "transform",
      index: 1,
      name: "publish",
      error: "unavailable",
    },
  });
});

Deno.test({
  name: "tap type constraints",
  ignore: true,
  fn() {
    const tapped: Transformer<string, string> = tap((value: string) => {
      void value;
    });
    const stringListener: Listener<Event<string>> = {
      run: () => ({ success: true }),
    };
    const numberListener: Listener<Event<number>> = {
      run: () => ({ success: true }),
    };

    pipe(tapped, stringListener);
    pipe(tap(stringListener), stringListener);

    // @ts-expect-error tap preserves its input type
    pipe(tap(stringListener), numberListener);
  },
});
