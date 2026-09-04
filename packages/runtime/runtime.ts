import type {
  Config,
  Context,
  Event,
  EventEnricher,
  Listener,
  ListenerResult,
  Route,
} from "@hooksmith/core";
import type { ListenerReport, RunReport, Runtime } from "./types.ts";
import {
  assertConfig,
  assertEventEnrichment,
  assertListenerResult,
} from "./validation.ts";

export function createRuntime<TEvent extends Event>(
  config: Config<TEvent>,
  context: Context,
): Runtime<TEvent> {
  assertConfig(config);

  return {
    process(event, _options = {}) {
      return executeEvent(event, config, context, false);
    },
    plan(event, _options = {}) {
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
  const enrichedEvent = await enrichEvent(event, config.enrichers ?? [], context);
  const results: ListenerReport[] = [];
  let matched = false;

  for (let routeIndex = 0; routeIndex < config.routes.length; routeIndex++) {
    const route = config.routes[routeIndex];
    const routeName = identifyRoute(route, routeIndex);

    if (route.when !== undefined) {
      const conditionName = route.when.name ?? `${routeName}/condition`;
      let matches: boolean;

      try {
        matches = await route.when.evaluate(enrichedEvent, context);
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
      enrichedEvent,
      context,
      plan,
      results,
    );
  }

  if (!matched && config.fallback !== undefined) {
    await executeListeners(
      config.fallback,
      "fallback",
      enrichedEvent,
      context,
      plan,
      results,
    );
  }

  return {
    mode: plan ? "plan" : "run",
    event: {
      type: enrichedEvent.type,
      timestamp: enrichedEvent.timestamp.toString(),
      source: enrichedEvent.source,
      subject: enrichedEvent.subject,
      metadata: enrichedEvent.metadata,
    },
    results,
    success: plan || results.every((result) => result.status === "success"),
    outcome: matched
      ? "matched"
      : config.fallback === undefined
      ? "unmatched"
      : "fallback",
  };
}

async function enrichEvent<TEvent extends Event>(
  event: TEvent,
  enrichers: EventEnricher<TEvent>[],
  context: Context,
): Promise<TEvent> {
  let enrichedEvent = event;

  for (let index = 0; index < enrichers.length; index++) {
    const enricher = enrichers[index];
    const enricherName = enricher.name ?? `enricher-${index + 1}`;

    let enrichment: unknown;
    try {
      enrichment = await enricher.enrich(enrichedEvent, context);
    } catch (error) {
      throw new Error(
        `Event enricher ${enricherName} failed: ${errorMessage(error)}`,
        { cause: error },
      );
    }

    assertEventEnrichment(enrichment, enricherName);

    if (enrichment.metadata !== undefined) {
      enrichedEvent = {
        ...enrichedEvent,
        metadata: {
          ...enrichedEvent.metadata,
          ...enrichment.metadata,
        },
      };
    }
  }

  return enrichedEvent;
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

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
