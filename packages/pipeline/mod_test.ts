import { assertEquals } from "@std/assert";
import type {
  Context,
  Event,
  Listener,
  Logger,
} from "@hooksmith/core";
import {
  each,
  merge,
  parallel,
  pipe,
  project,
  split,
  type Transformer,
  when,
} from "./mod.ts";

interface PageData {
  title: string;
  url: string;
}

interface LoadedPage extends PageData {
  content: string;
}

interface Announcement {
  text: string;
}

const logger: Logger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
};

const context: Context = { log: logger };

const event: Event<PageData> = {
  type: "page.published",
  timestamp: Temporal.Instant.from("2026-09-01T17:00:00Z"),
  source: { kind: "website", id: "example.com" },
  subject: { kind: "page", id: "/hello" },
  metadata: { environment: "production" },
  data: {
    title: "Hello, Hooksmith",
    url: "https://example.com/hello",
  },
};

Deno.test("pipe transforms data and preserves the event envelope", async () => {
  const originalData = event.data;

  const loadPage: Transformer<PageData, LoadedPage> = {
    name: "load-page",
    transform(page, transformContext) {
      assertEquals(transformContext.originalData, originalData);
      return {
        ...page,
        content: "Loaded page content",
      };
    },
  };

  const createAnnouncement = project<LoadedPage, Announcement>(
    (page, transformContext) => {
      assertEquals(transformContext.originalData, originalData);
      return { text: `${page.title}: ${page.content}` };
    },
    "create-announcement",
  );

  let received: Event<Announcement> | undefined;
  const listener: Listener<Event<Announcement>> = {
    name: "capture",
    run(current) {
      received = current;
      return { success: true, message: current.data.text };
    },
  };

  const piped = pipe(loadPage, createAnnouncement, listener);
  const result = await piped.run(event, context);

  assertEquals(piped.name, "capture");
  assertEquals(result, {
    success: true,
    message: "Hello, Hooksmith: Loaded page content",
  });
  assertEquals(received, {
    ...event,
    data: { text: "Hello, Hooksmith: Loaded page content" },
  });
});

Deno.test("pipe can wrap a listener without transformations", async () => {
  const listener: Listener<Event<PageData>> = {
    name: "direct",
    run(current) {
      return { success: true, data: current.data.title };
    },
  };

  const result = await pipe(listener).run(event, context);

  assertEquals(result, { success: true, data: "Hello, Hooksmith" });
});

Deno.test("pipe reports unnamed transformation failures by ordinal", async () => {
  const listener: Listener<Event<boolean>> = {
    run() {
      return { success: true };
    },
  };

  const result = await pipe(
    project((value: string) => value.length),
    project<number, boolean>(() => {
      throw new Error("boom");
    }),
    listener,
  ).run({ ...event, data: "hello" }, context);

  assertEquals(result, {
    success: false,
    message: "Transformation #2 failed: boom",
    data: {
      stage: "transform",
      index: 2,
      error: "boom",
    },
  });
});

Deno.test("pipe reports named transformation failures by name", async () => {
  const listener: Listener<Event<number>> = {
    run() {
      return { success: true };
    },
  };

  const result = await pipe(
    project<string, number>(() => {
      throw new Error("unavailable");
    }, "load-page"),
    listener,
  ).run({ ...event, data: "hello" }, context);

  assertEquals(result, {
    success: false,
    message: 'Transformation "load-page" failed: unavailable',
    data: {
      stage: "transform",
      index: 1,
      name: "load-page",
      error: "unavailable",
    },
  });
});

Deno.test("parallel runs transformations against the same input", async () => {
  const transformation = parallel(
    project((value: string) => value.length),
    project((value: string) => value.toUpperCase()),
  );

  const result = await transformation.transform("hooksmith", {
    ...context,
    originalData: "original",
  });

  assertEquals(result, [9, "HOOKSMITH"]);
});

Deno.test("parallel identifies a failing branch", async () => {
  const listener: Listener<Event<readonly [number, string]>> = {
    run() {
      return { success: true };
    },
  };

  const result = await pipe(
    parallel(
      project((value: string) => value.length),
      project<string, string>(() => {
        throw new Error("no image");
      }, "generate-image"),
    ),
    listener,
  ).run({ ...event, data: "hooksmith" }, context);

  assertEquals(result.message,
    'Transformation #1 failed: Parallel transformation "generate-image" failed: no image');
});

Deno.test("when applies a same-type transformation conditionally", async () => {
  let invocations = 0;
  const trim: Transformer<string, string> = {
    transform(value) {
      invocations++;
      return value.trim();
    },
  };

  const transformation = when(
    (value: string) => value.includes(" "),
    trim,
  );
  const transformContext = { ...context, originalData: "original" };

  assertEquals(await transformation.transform(" hooksmith ", transformContext), "hooksmith");
  assertEquals(await transformation.transform("hooksmith", transformContext), "hooksmith");
  assertEquals(invocations, 1);
});

Deno.test("split, each, and merge compose collection pipelines", async () => {
  const listener: Listener<Event<{ items: readonly number[] }>> = {
    run(current) {
      return { success: true, data: current.data.items };
    },
  };

  const result = await pipe(
    split((value: string) => value.split(",")),
    each(project((value: string) => value.trim().length)),
    merge(),
    listener,
  ).run({ ...event, data: "one, three, five" }, context);

  assertEquals(result, { success: true, data: [3, 5, 4] });
});

Deno.test("merge preserves tuple types produced by parallel", async () => {
  const listener: Listener<
    Event<{ items: readonly [number, string] }>
  > = {
    run(current) {
      return { success: true, data: current.data.items };
    },
  };

  const result = await pipe(
    parallel(
      project((value: string) => value.length),
      project((value: string) => value.toUpperCase()),
    ),
    merge(),
    listener,
  ).run({ ...event, data: "hooksmith" }, context);

  assertEquals(result, { success: true, data: [9, "HOOKSMITH"] });
});

if (false) {
  const stringToNumber: Transformer<string, number> = {
    transform: (value) => value.length,
  };
  const numberToBoolean: Transformer<number, boolean> = {
    transform: (value) => value > 0,
  };
  const booleanListener: Listener<Event<boolean>> = {
    run: () => ({ success: true }),
  };

  pipe(stringToNumber, numberToBoolean, booleanListener);

  // @ts-expect-error pipeline stages must form a valid type sequence
  pipe(numberToBoolean, stringToNumber, booleanListener);

  // @ts-expect-error parallel branches must accept the same input
  parallel(stringToNumber, numberToBoolean);
}
