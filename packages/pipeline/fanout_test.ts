import { assertEquals } from "@std/assert";
import {
  type Context,
  type Event,
  type Listener,
  nullLoggerFactory,
} from "@hooksmith/core";
import { each, pipe, split } from "./mod.ts";

const context: Context = { logger: nullLoggerFactory };

const event: Event<string> = {
  type: "items.ready",
  timestamp: Temporal.Instant.from("2026-09-03T08:00:00Z"),
  source: { kind: "test", id: "source" },
  subject: { kind: "batch", id: "one" },
  metadata: {},
  data: "one,two,bad",
};

Deno.test("each fans out a collection to a listener and aggregates results", async () => {
  const received: Event<string>[] = [];
  const listener: Listener<Event<string>> = {
    name: "capture",
    run(current) {
      received.push(current);
      return {
        success: current.data !== "bad",
        message: current.data,
      };
    },
  };

  const fanout = each(listener);
  const result = await pipe(
    split((value: string) => value.split(",")),
    fanout,
  ).run(event, context);

  assertEquals(fanout.name, "capture");
  assertEquals(received, [
    { ...event, data: "one" },
    { ...event, data: "two" },
    { ...event, data: "bad" },
  ]);
  assertEquals(result, {
    success: false,
    data: {
      results: [
        { success: true, message: "one" },
        { success: true, message: "two" },
        { success: false, message: "bad" },
      ],
    },
  });
});

Deno.test("each listener succeeds for an empty collection", async () => {
  const listener: Listener<Event<string>> = {
    run() {
      throw new Error("listener should not run");
    },
  };

  const result = await each(listener).run(
    { ...event, data: [] },
    context,
  );

  assertEquals(result, {
    success: true,
    data: { results: [] },
  });
});

Deno.test({
  name: "each listener type constraints",
  ignore: true,
  fn() {
    const stringListener: Listener<Event<string>> = {
      run: () => ({ success: true }),
    };
    const numberListener: Listener<Event<number>> = {
      run: () => ({ success: true }),
    };

    pipe(
      split((value: string) => value.split(",")),
      each(stringListener),
    );

    // @ts-expect-error fan-out listener must accept the split item type
    pipe(split((value: string) => value.split(",")), each(numberListener));
  },
});
