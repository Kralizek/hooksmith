/** Identifies a resource associated with an event. */
export interface ResourceReference {
  kind: string;
  id?: string;
}

/** In-memory Hooksmith event processed by conditions and listeners. */
export interface Event<TData = unknown> {
  type: string;
  timestamp: Temporal.Instant;
  source: ResourceReference;
  subject?: ResourceReference;
  metadata?: Record<string, unknown>;
  data: TData;
}

/**
 * Serialization-friendly object model schema for an event document.
 *
 * Event documents can be represented by transports such as YAML or JSON.
 */
export interface EventDocument<TData = unknown> {
  type: string;
  timestamp: string;
  source: ResourceReference;
  subject?: ResourceReference;
  metadata?: Record<string, unknown>;
  data: TData;
}

/** Structured properties attached to a log entry. */
export type LogProperties = Record<string, unknown>;

/** Severity methods exposed by a Hooksmith logger. */
export interface LogMethods {
  trace(template: string, properties?: LogProperties, error?: unknown): void;
  debug(template: string, properties?: LogProperties, error?: unknown): void;
  info(template: string, properties?: LogProperties, error?: unknown): void;
  warn(template: string, properties?: LogProperties, error?: unknown): void;
  error(template: string, properties?: LogProperties, error?: unknown): void;
}

/** Logging levels supported by Hooksmith. */
export type LogLevel = keyof LogMethods;

/** Source-bound logging contract exposed to Hooksmith components. */
export interface Logger extends LogMethods {}

/** Creates loggers bound to the component source emitting log entries. */
export interface LoggerFactory {
  getLogger(source: string): Logger;
}

/** Shared execution context passed to conditions and listeners. */
export interface Context {
  logger: LoggerFactory;
}

/** Context passed to transformers, including the original input data. */
export interface TransformContext extends Context {
  readonly originalData: unknown;
}

/** Typed transformation stage that converts one value into another. */
export interface Transformer<TInput, TOutput> {
  name?: string;
  transform(
    input: TInput,
    context: TransformContext,
  ): TOutput | Promise<TOutput>;
}

/** Metadata additions produced by an event enricher. */
export interface EventEnrichment {
  metadata?: Record<string, unknown>;
}

/** Configuration-level event enrichment stage executed before routing. */
export interface EventEnricher<TEvent extends Event = Event> {
  name?: string;
  enrich(
    event: TEvent,
    context: Context,
  ): EventEnrichment | Promise<EventEnrichment>;
}

/** Predicate used by a route to decide whether an event matches. */
export interface Condition<TEvent extends Event = Event> {
  name?: string;
  evaluate(
    event: TEvent,
    context: Context,
  ): boolean | Promise<boolean>;
}

/** Result returned by a Hooksmith listener. */
export interface ListenerResult<TData = unknown> {
  success: boolean;
  message?: string;
  data?: TData;
}

/** Event consumer invoked by the Hooksmith runtime. */
export interface Listener<TEvent extends Event = Event> {
  name?: string;
  run(
    event: TEvent,
    context: Context,
  ): ListenerResult | Promise<ListenerResult>;
}

/** Ordered route containing an optional condition and its listeners. */
export interface Route<TEvent extends Event = Event> {
  name?: string;
  when?: Condition<TEvent>;
  listeners: Listener<TEvent>[];
}

/** Hooksmith runtime configuration for enrichment, routes and fallback listeners. */
export interface Config<TEvent extends Event = Event> {
  enrichers?: EventEnricher<TEvent>[];
  routes: Route<TEvent>[];
  fallback?: Listener<TEvent>[];
}
