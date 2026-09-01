import type {
  Config,
  Context,
  Event,
  EventDocument,
  Listener,
  ListenerResult,
  ResourceReference,
  Route,
} from "@hooksmith/core";

export type ExecutionStatus = "planned" | "success" | "failure";

export interface ListenerReport {
  route: string;
  listener: string;
  status: ExecutionStatus;
  message?: string;
  data?: unknown;
}

export interface EventReport {
  type: string;
  timestamp: string;
  source: ResourceReference;
  subject?: ResourceReference;
  metadata?: Record<string, unknown>;
}

export interface RunReport {
  mode: "run" | "plan";
  event: EventReport;
  results: ListenerReport[];
  success: boolean;
}

export interface Runtime<TEvent extends Event = Event> {
  process(event: TEvent): Promise<RunReport>;
  plan(event: TEvent): Promise<RunReport>;
}

export function hydrateEvent<TData>(
  document: EventDocument<TData>,
): Event<TData> {
  assertEventDocument(document);

  let timestamp: Temporal.Instant;
  try {
    timestamp = Temporal.Instant.from(document.timestamp);
  } catch (error) {
    throw new Error(
      "Event timestamp must be a valid Temporal.Instant string.",
      {
        cause: error,
      },
    );
  }

  return {
    ...document,
    timestamp,
  };
}

export function createRuntime<TEvent extends Event>(
  config: Config<TEvent>,
  context: Context,
): Runtime<TEvent> {
  assertConfig(config);

  return {
    process(event) {
      return executeEvent(event, config, context, false);
    },
    plan(event) {
      return executeEvent(event, config, context, true);
    },
  };
}

async function executeEvent<TEvent extends Event>(
  event: TEvent,
  config: Config<TEvent>,
  context: Context,
  plan: boolean,
): Promise<RunReport> {
  const results: ListenerReport[] = [];
  let matched = false;

  for (let routeIndex = 0; routeIndex < config.routes.length; routeIndex++) {
    const route = config.routes[routeIndex];
    const routeName = identifyRoute(route, routeIndex);

    if (route.when !== undefined) {
      const conditionName = route.when.name ?? `${routeName}/condition`;
      let matches: boolean;

      try {
        matches = await route.when.evaluate(event, context);
      } catch (error) {
        throw new Error(
          `Condition ${conditionName} failed: ${errorMessage(error)}`,
          { cause: error },
        );
      }

      if (typeof matches !== "boolean") {
        throw new Error(`Condition ${conditionName} must return a boolean.`);
      }
      if (!matches) {
        continue;
      }
    }

    matched = true;
    await executeListeners(
      route.listeners,
      routeName,
      event,
      context,
      plan,
      results,
    );
  }

  if (!matched && config.fallback !== undefined) {
    await executeListeners(
      config.fallback,
      "fallback",
      event,
      context,
      plan,
      results,
    );
  }

  return {
    mode: plan ? "plan" : "run",
    event: {
      type: event.type,
      timestamp: event.timestamp.toString(),
      source: event.source,
      subject: event.subject,
      metadata: event.metadata,
    },
    results,
    success: plan || results.every((result) => result.status === "success"),
  };
}

async function executeListeners<TEvent extends Event>(
  listeners: Listener<TEvent>[],
  routeName: string,
  event: TEvent,
  context: Context,
  plan: boolean,
  results: ListenerReport[],
): Promise<void> {
  for (
    let listenerIndex = 0;
    listenerIndex < listeners.length;
    listenerIndex++
  ) {
    const listener = listeners[listenerIndex];
    const listenerName = listener.name ?? `listener-${listenerIndex + 1}`;

    if (plan) {
      results.push({
        route: routeName,
        listener: listenerName,
        status: "planned",
      });
      continue;
    }

    try {
      const result = await listener.run(event, context);
      assertListenerResult(result, routeName, listenerName);
      results.push(toListenerReport(routeName, listenerName, result));
    } catch (error) {
      results.push({
        route: routeName,
        listener: listenerName,
        status: "failure",
        message: errorMessage(error),
      });
    }
  }
}

function toListenerReport(
  route: string,
  listener: string,
  result: ListenerResult,
): ListenerReport {
  return {
    route,
    listener,
    status: result.success ? "success" : "failure",
    message: result.message,
    data: result.data,
  };
}

function identifyRoute(route: Route, index: number): string {
  return route.name ?? `route-${index + 1}`;
}

export function assertConfig(value: unknown): asserts value is Config {
  if (!isRecord(value)) {
    throw new Error("Config must be an object.");
  }

  if (!Array.isArray(value.routes)) {
    throw new Error("Config.routes must be an array.");
  }

  value.routes.forEach((route, index) => assertRoute(route, index));

  if (value.fallback !== undefined) {
    if (!Array.isArray(value.fallback)) {
      throw new Error("Config.fallback must be an array.");
    }

    value.fallback.forEach((listener, index) =>
      assertListener(listener, `fallback listener ${index + 1}`)
    );
  }
}

export function assertEventDocument(
  value: unknown,
): asserts value is EventDocument {
  if (!isRecord(value)) {
    throw new Error("Event document must be an object.");
  }

  if (typeof value.type !== "string" || value.type.length === 0) {
    throw new Error("Event document type must be a non-empty string.");
  }

  if (typeof value.timestamp !== "string" || value.timestamp.length === 0) {
    throw new Error("Event document timestamp must be a non-empty string.");
  }

  assertResourceReference(value.source, "source");

  if (value.subject !== undefined) {
    assertResourceReference(value.subject, "subject");
  }

  if (value.metadata !== undefined && !isRecord(value.metadata)) {
    throw new Error("Event document metadata must be an object.");
  }

  if (!("data" in value)) {
    throw new Error("Event document data is required.");
  }
}

function assertRoute(value: unknown, index: number): asserts value is Route {
  const label = `Route ${index + 1}`;

  if (!isRecord(value)) {
    throw new Error(`${label} must be an object.`);
  }

  if (value.name !== undefined && typeof value.name !== "string") {
    throw new Error(`${label}.name must be a string.`);
  }

  if (value.when !== undefined) {
    if (!isRecord(value.when) || typeof value.when.evaluate !== "function") {
      throw new Error(`${label}.when must expose evaluate().`);
    }

    if (value.when.name !== undefined && typeof value.when.name !== "string") {
      throw new Error(`${label}.when.name must be a string.`);
    }
  }

  if (!Array.isArray(value.listeners)) {
    throw new Error(`${label}.listeners must be an array.`);
  }

  value.listeners.forEach((listener, listenerIndex) =>
    assertListener(listener, `${label} listener ${listenerIndex + 1}`)
  );
}

function assertListener(
  value: unknown,
  label: string,
): asserts value is Listener {
  if (!isRecord(value) || typeof value.run !== "function") {
    throw new Error(`${label} must expose run().`);
  }

  if (value.name !== undefined && typeof value.name !== "string") {
    throw new Error(`${label}.name must be a string.`);
  }
}

function assertListenerResult(
  value: unknown,
  route: string,
  listener: string,
): asserts value is ListenerResult {
  if (!isRecord(value) || typeof value.success !== "boolean") {
    throw new Error(
      `Listener ${route}/${listener} must return an object with a boolean success property.`,
    );
  }

  if (value.message !== undefined && typeof value.message !== "string") {
    throw new Error(
      `Listener ${route}/${listener} returned a non-string message.`,
    );
  }
}

function assertResourceReference(
  value: unknown,
  label: string,
): asserts value is ResourceReference {
  if (!isRecord(value)) {
    throw new Error(`Event document ${label} must be an object.`);
  }

  if (typeof value.kind !== "string" || value.kind.length === 0) {
    throw new Error(`Event document ${label}.kind must be a non-empty string.`);
  }

  if (value.id !== undefined && typeof value.id !== "string") {
    throw new Error(`Event document ${label}.id must be a string.`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
