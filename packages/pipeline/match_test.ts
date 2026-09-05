import { assertEquals, assertRejects } from "@std/assert";
import type {
  Context,
  Event,
  Listener,
  Logger,
  LoggerFactory,
} from "@hooksmith/core";
import {
  caseOf,
  match,
  otherwise,
  pipe,
  project,
  type Transformer,
} from "./mod.ts";

const logger: Logger = {
  trace() {},
  debug() {},
  info() {},
  warn() {},
  error() {},
};

const loggerFactory: LoggerFactory = {
  getLogger() {
    return logger;
  },
};

const context: Context = { logger: loggerFactory };

Deno.test("match selects the first matching case", async () => {
  const selected: string[] = [];
  const transformation = match(
    caseOf(
      (value: number) => value > 0,
      project((value: number) => {
        selected.push("first");
        return `positive:${value}`;
      }),
    ),
    caseOf(
      (value: number) => value > 10,
      project((value: number) => {
        selected.push("second");
        return `large:${value}`;
      }),
    ),
    otherwise(project((value: number) => {
      selected.push("otherwise");
      return `other:${value}`;
    })),
  );

  const result = await transformation.transform(20, {
    ...context,
    originalData: 20,
  });

  assertEquals(result, "positive:20");
  assertEquals(selected, ["first"]);
});

Deno.test("match uses otherwise when no case matches", async () => {
  const transformation = match(
    caseOf(
      (value: number) => value > 0,
      project((value: number) => `positive:${value}`),
    ),
    otherwise(project((value: number) => `other:${value}`)),
  );

  assertEquals(
    await transformation.transform(-2, { ...context, originalData: -2 }),
    "other:-2",
  );
});

Deno.test("match passes transform context to predicates and transformers", async () => {
  const transformContext = { ...context, originalData: "original" };
  const seen: unknown[] = [];
  const transformation = match(
    caseOf(
      (_value: string, currentContext) => {
        seen.push(currentContext);
        return true;
      },
      project((value: string, currentContext) => {
        seen.push(currentContext);
        return value.length;
      }),
    ),
    otherwise(project((value: string) => value.length)),
  );

  assertEquals(
    await transformation.transform("hooksmith", transformContext),
    9,
  );
  assertEquals(seen, [transformContext, transformContext]);
});

Deno.test("match composes as a normal pipeline transformer", async () => {
  const listener: Listener<Event<string>> = {
    run(event) {
      return { success: true, data: event.data };
    },
  };

  const result = await pipe(
    match(
      caseOf(
        (value: number) => value % 2 === 0,
        project((value: number) => `even:${value}`),
      ),
      otherwise(project((value: number) => `odd:${value}`)),
    ),
    listener,
  ).run({
    type: "number.ready",
    timestamp: Temporal.Instant.from("2026-09-03T09:00:00Z"),
    source: { kind: "test", id: "source" },
    subject: { kind: "number", id: "4" },
    metadata: {},
    data: 4,
  }, context);

  assertEquals(result, { success: true, data: "even:4" });
});

Deno.test("match rejects a missing otherwise branch at runtime", async () => {
  const unsafeMatch = match as unknown as (
    ...branches: unknown[]
  ) => Transformer<number, string>;

  const transformation = unsafeMatch(
    caseOf(
      (value: number) => value > 0,
      project((value: number) => String(value)),
    ),
  );

  await assertRejects(
    async () =>
      await transformation.transform(1, { ...context, originalData: 1 }),
    Error,
    "match requires a final otherwise branch.",
  );
});

Deno.test({
  name: "match type constraints",
  ignore: true,
  fn() {
    const numberOutput: Transformer<string, number> = {
      transform: (value) => value.length,
    };
    const stringOutput: Transformer<string, string> = {
      transform: (value) => value.toUpperCase(),
    };
    const numberInput: Transformer<number, number> = {
      transform: (value) => value * 2,
    };

    match(
      caseOf((value: string) => value.length > 0, numberOutput),
      otherwise(numberOutput),
    );

    match(
      caseOf((value: string) => value.length > 0, numberOutput),
      // @ts-expect-error all match branches must produce the same output type
      otherwise(stringOutput),
    );

    match(
      caseOf((value: string) => value.length > 0, numberOutput),
      // @ts-expect-error all match branches must accept the same input type
      otherwise(numberInput),
    );
  },
});
