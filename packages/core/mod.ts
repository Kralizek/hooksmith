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

/** Logging contract exposed through the Hooksmith execution context. */
export interface Logger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

/** Shared execution context passed to conditions and listeners. */
export interface Context {
  log: Logger;
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

/** Hooksmith runtime configuration for routes and optional fallback listeners. */
export interface Config<TEvent extends Event = Event> {
  routes: Route<TEvent>[];
  fallback?: Listener<TEvent>[];
}
