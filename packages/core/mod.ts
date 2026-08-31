export interface ResourceReference {
  kind: string;
  id?: string;
}

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

export interface Logger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

export interface Context {
  log: Logger;
}

export interface Condition<TEvent extends Event = Event> {
  name?: string;
  evaluate(
    event: TEvent,
    context: Context,
  ): boolean | Promise<boolean>;
}

export interface ListenerResult<TData = unknown> {
  success: boolean;
  message?: string;
  data?: TData;
}

export interface Listener<TEvent extends Event = Event> {
  name?: string;
  run(
    event: TEvent,
    context: Context,
  ): ListenerResult | Promise<ListenerResult>;
}

export interface Route<TEvent extends Event = Event> {
  name?: string;
  when?: Condition<TEvent>;
  listeners: Listener<TEvent>[];
}

export interface Config<TEvent extends Event = Event> {
  routes: Route<TEvent>[];
  fallback?: Listener<TEvent>[];
}
