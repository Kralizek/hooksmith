import type {
  Config,
  Context,
  Event,
  EventEnricher,
  Listener,
  ListenerResult,
  Logger,
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
  const log = context.logger.getLogger("Runtime");

  log.debug("Runtime initialized with {routeCount} routes", {
    routeCount: config.routes.length,
    enricherCount: config.enrichers?.length ?? 0,
    fallbackListenerCount: config.fallback?.length ?? 0,
  });

  return {
    process(event, _options = {}) {
      return executeEvent(event, config, context, log, false);
    },
    plan(event, _options = {}) {
      return executeEvent(event, config, context, log, true);
    },
  };
}

async function executeEvent<TEvent extends Event>(
  event: TEvent,
  config: Config<TEvent>,
  context: Context,
  log: Logger,
  plan: boolean,
): Promise<RunReport> {
  log.debug("{mode} event {eventType}", {
    mode: plan ? "Planning" : "Processing",
    eventType: event.type,
  });

  const enrichedEvent = await enrichEvent(
    event,
    config.enrichers ?? [],
    context,
    log,
  );
  const results: ListenerReport[] = [];
  let matched = false;

  for (let routeIndex = 0; routeIndex < config.routes.length; routeIndex++) {
    const route = config.routes[routeIndex];
    const routeName = identifyRoute(route, routeIndex);

    if (route.when !== undefined) {
      const conditionName = route.when.name ?? `${routeName}/condition`;
      let matches: boolean;

      log.debug("Evaluating condition {condition} for route {route}", {
        condition: conditionName,
        route: routeName,
      });

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

      log.debug("Condition {condition} evaluated to {matches}", {
        condition: conditionName,
        route: routeName,
        matches,
      });

      if (!matches) {
        continue;
      }
    }

    matched = true;
    log.debug("Route {route} matched", { route: routeName });
    await executeListeners(
      route.listeners,
      routeName,
      enrichedEvent,
      context,
      log,
      plan,
      results,
    );
  }

  if (!matched && config.fallback !== undefined) {
    log.debug("No route matched; executing fallback listeners");
    await executeListeners(
      config.fallback,
      "fallback",
      enrichedEvent,
      context,
      log,
      plan,
      results,
    );
  }

  const outcome = matched
    ? "matched"
    : config.fallback === undefined
    ? "unmatched"
    : "fallback";
  const success = plan || results.every((result) => result.status === "success");

  log.debug("Event {eventType} completed with outcome {outcome}", {
    eventType: enrichedEvent.type,
    outcome,
    success,
    listenerCount: results.length,
  });

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
    success,
    outcome,
  };
}

async function enrichEvent<TEvent extends Event>(
  event: TEvent,
  enrichers: EventEnricher<TEvent>[],
  context: Context,
  log: Logger,
): Promise<TEvent> {
  let enrichedEvent = event;

  for (let index = 0; index < enrichers.length; index++) {
    const enricher = enrichers[index];
    const enricherName = enricher.name ?? `enricher-${index + 1}`;

    log.debug("Executing event enricher {enricher}", { enricher: enricherName });

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

    log.debug("Event enricher {enricher} completed", { enricher: enricherName });
  }

  return enrichedEvent;
}

async function executeListeners<TEvent extends Event>(
  listeners: Listener<TEvent>[],
  routeName: string,
  event: TEvent,
  context: Context,
  log: Logger,
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
      log.debug("Planning listener {listener} for route {route}", {
        listener: listenerName,
        route: routeName,
      });
      results.push({
        route: routeName,
        listener: listenerName,
        status: "planned",
      });
      continue;
    }

    log.debug("Executing listener {listener} for route {route}", {
      listener: listenerName,
      route: routeName,
    });

    try {
      const result = await listener.run(event, context);
      assertListenerResult(result, routeName, listenerName);
      const report = toListenerReport(routeName, listenerName, result);
      results.push(report);
      log.debug("Listener {listener} completed with status {status}", {
        listener: listenerName,
        route: routeName,
        status: report.status,
      });
    } catch (error) {
      log.error(
        "Listener {listener} threw while executing route {route}",
        { listener: listenerName, route: routeName },
        error,
      );
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
