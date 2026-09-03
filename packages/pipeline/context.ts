import type { Context, Event } from "@hooksmith/core";

const eventContext = Symbol("hooksmith.pipeline.event");

export interface TransformContext extends Context {
  readonly originalData: unknown;
}

type PipelineTransformContext = TransformContext & {
  readonly [eventContext]: Event<unknown>;
};

/** @internal */
export function createTransformContext(
  context: Context,
  event: Event<unknown>,
): TransformContext {
  return {
    ...context,
    originalData: event.data,
    [eventContext]: event,
  } as PipelineTransformContext;
}

/** @internal */
export function getTransformEvent(
  context: TransformContext,
): Event<unknown> | undefined {
  return (context as Partial<PipelineTransformContext>)[eventContext];
}
