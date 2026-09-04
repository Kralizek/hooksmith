import type {
  Config,
  EventDocument,
  EventEnricher,
  EventEnrichment,
  Listener,
  ListenerResult,
  ResourceReference,
  Route,
} from "@hooksmith/core";

export function assertConfig(value: unknown): asserts value is Config {
  if (!isRecord(value)) {
    throw new Error("Config must be an object.");
  }

  if (value.enrichers !== undefined) {
    if (!Array.isArray(value.enrichers)) {
      throw new Error("Config.enrichers must be an array.");
    }

    value.enrichers.forEach((enricher, index) =>
      assertEventEnricher(enricher, `Config enricher ${index + 1}`)
    );
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

export function assertEventEnrichment(
  value: unknown,
  enricher: string,
): asserts value is EventEnrichment {
  if (!isRecord(value)) {
    throw new Error(`Event enricher ${enricher} must return an object.`);
  }

  if (value.metadata !== undefined && !isRecord(value.metadata)) {
    throw new Error(
      `Event enricher ${enricher} returned non-object metadata.`,
    );
  }
}

export function assertListenerResult(
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

function assertEventEnricher(
  value: unknown,
  label: string,
): asserts value is EventEnricher {
  if (!isRecord(value) || typeof value.enrich !== "function") {
    throw new Error(`${label} must expose enrich().`);
  }

  if (value.name !== undefined && typeof value.name !== "string") {
    throw new Error(`${label}.name must be a string.`);
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
