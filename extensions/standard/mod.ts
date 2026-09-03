import type { Condition, Event, Listener, Logger } from "@hooksmith/core";

/** Logging levels supported by the Hooksmith logger contract. */
export type LogLevel = keyof Logger;

export function eventType<TEvent extends Event = Event>(
  type: string,
): Condition<TEvent> {
  return condition(`event-type:${type}`, (event) => event.type === type);
}

export function sourceKind<TEvent extends Event = Event>(
  kind: string,
): Condition<TEvent> {
  return condition(
    `source-kind:${kind}`,
    (event) => event.source.kind === kind,
  );
}

export function sourceId<TEvent extends Event = Event>(
  id: string,
): Condition<TEvent> {
  return condition(`source-id:${id}`, (event) => event.source.id === id);
}

export function subjectKind<TEvent extends Event = Event>(
  kind: string,
): Condition<TEvent> {
  return condition(
    `subject-kind:${kind}`,
    (event) => event.subject?.kind === kind,
  );
}

export function subjectId<TEvent extends Event = Event>(
  id: string,
): Condition<TEvent> {
  return condition(`subject-id:${id}`, (event) => event.subject?.id === id);
}

export function data<TData>(
  predicate: (data: TData) => boolean | Promise<boolean>,
): Condition<Event<TData>> {
  return {
    name: "data",
    evaluate(event) {
      return predicate(event.data);
    },
  };
}

type MetadataPredicate = (value: unknown) => boolean | Promise<boolean>;

export function metadata(
  key: string,
  predicate: MetadataPredicate,
): Condition;
export function metadata(key: string, value: unknown): Condition;
export function metadata(
  key: string,
  valueOrPredicate: unknown,
): Condition {
  const predicate = typeof valueOrPredicate === "function"
    ? valueOrPredicate as MetadataPredicate
    : (value: unknown) => value === valueOrPredicate;

  return {
    name: `metadata:${key}`,
    evaluate(event) {
      if (event.metadata === undefined || !Object.hasOwn(event.metadata, key)) {
        return false;
      }

      return predicate(event.metadata[key]);
    },
  };
}

export function all<TEvent extends Event = Event>(
  ...conditions: Condition<TEvent>[]
): Condition<TEvent> {
  return {
    name: "all",
    async evaluate(event, context) {
      for (const item of conditions) {
        if (!(await item.evaluate(event, context))) {
          return false;
        }
      }

      return true;
    },
  };
}

export function any<TEvent extends Event = Event>(
  ...conditions: Condition<TEvent>[]
): Condition<TEvent> {
  return {
    name: "any",
    async evaluate(event, context) {
      for (const item of conditions) {
        if (await item.evaluate(event, context)) {
          return true;
        }
      }

      return false;
    },
  };
}

export function not<TEvent extends Event = Event>(
  value: Condition<TEvent>,
): Condition<TEvent> {
  return {
    name: "not",
    async evaluate(event, context) {
      return !(await value.evaluate(event, context));
    },
  };
}

export function logEvent<TEvent extends Event = Event>(
  level: LogLevel = "info",
): Listener<TEvent> {
  return {
    name: "log-event",
    run(event, { log }) {
      log[level](`Event ${event.type}`, event);
      return {
        success: true,
        message: `Logged ${event.type}`,
      };
    },
  };
}

function condition<TEvent extends Event>(
  name: string,
  evaluate: (event: TEvent) => boolean,
): Condition<TEvent> {
  return {
    name,
    evaluate,
  };
}
