import type { Event, ResourceReference } from "@hooksmith/core";

/** Execution state reported for an individual listener. */
export type ExecutionStatus = "planned" | "success" | "failure";

/** Routing result for a processed event. */
export type RoutingOutcome = "matched" | "fallback" | "unmatched";

/** Runtime report for one listener invocation. */
export interface ListenerReport {
  route: string;
  listener: string;
  status: ExecutionStatus;
  message?: string;
  data?: unknown;
}

/** Serializable event envelope included in runtime reports. */
export interface EventReport {
  type: string;
  timestamp: string;
  source: ResourceReference;
  subject?: ResourceReference;
  metadata?: Record<string, unknown>;
}

/** Complete report produced by processing or planning one event. */
export interface RunReport {
  mode: "run" | "plan";
  event: EventReport;
  results: ListenerReport[];
  success: boolean;
  outcome?: RoutingOutcome;
}

/** Reserved options for runtime event processing. */
export type ProcessOptions = Readonly<Record<string, never>>;

/** Reserved options for runtime event planning. */
export type PlanOptions = Readonly<Record<string, never>>;

/** Reusable Hooksmith runtime capable of processing and planning events. */
export interface Runtime<TEvent extends Event = Event> {
  process(event: TEvent, options?: ProcessOptions): Promise<RunReport>;
  plan(event: TEvent, options?: PlanOptions): Promise<RunReport>;
}
