import type { Event, Listener, ListenerResult } from "@hooksmith/core";
import { createTransformContext } from "./context.ts";
import { errorMessage } from "./errors.ts";
import type { MergeOperator } from "./merge.ts";
import {
  elapsedSeconds,
  getPipelineTelemetry,
} from "./telemetry.ts";
import type { Transformer } from "./transformer.ts";

/** Optional configuration used to assign an explicit pipeline listener name. */
export interface PipeOptions {
  name: string;
}

type PipeInput<TItems extends readonly unknown[]> = TItems extends readonly [
  Transformer<infer TInput, infer _TOutput>,
  ...readonly unknown[],
] ? TInput
  : TItems extends readonly [Listener<Event<infer TData>>] ? TData
  : never;

type ApplyStep<TInput, TStep> = TStep extends MergeOperator
  ? TInput extends readonly unknown[] ? { items: TInput } : never
  : TStep extends Transformer<infer TStepInput, infer TOutput>
    ? TInput extends TStepInput ? TOutput : never
  : never;

type IsValidPipeTail<TInput, TItems extends readonly unknown[]> = TItems extends
  readonly [infer TNext, ...infer TRest]
  ? TNext extends Listener<Event<infer TListenerData>>
    ? TRest extends readonly [] ? TInput extends TListenerData ? true : false
    : false
  : [ApplyStep<TInput, TNext>] extends [never] ? false
  : IsValidPipeTail<ApplyStep<TInput, TNext>, TRest>
  : false;

type IsValidPipe<TItems extends readonly unknown[]> = TItems extends readonly [
  Transformer<infer _TInput, infer TOutput>,
  ...infer TRest,
] ? IsValidPipeTail<TOutput, TRest>
  : TItems extends readonly [Listener<Event<unknown>>] ? true
  : false;

type ValidPipe<TItems extends readonly unknown[]> = IsValidPipe<TItems> extends
  true ? TItems
  : never;

/** Composes transformations with a final Hooksmith listener. */
export function pipe<const TItems extends readonly unknown[]>(
  ...items: TItems & ValidPipe<TItems>
): Listener<Event<PipeInput<TItems>>>;
export function pipe<const TItems extends readonly unknown[]>(
  options: PipeOptions,
  ...items: TItems & ValidPipe<TItems>
): Listener<Event<PipeInput<TItems>>>;
export function pipe(
  ...args: readonly unknown[]
): Listener<Event<unknown>> {
  const options = isPipeOptions(args[0]) ? args[0] : undefined;
  const items = options === undefined ? args : args.slice(1);

  if (items.length === 0) {
    throw new Error("pipe requires a final listener.");
  }

  const listener = items.at(-1) as Listener<Event<unknown>>;
  const transformations = items.slice(0, -1) as readonly (
    | Transformer<unknown, unknown>
    | MergeOperator
  )[];
  const name = options?.name ?? `pipe:${listener.name ?? "listener"}`;

  return {
    name,
    async run(event, context): Promise<ListenerResult> {
      const log = context.logger.getLogger(`Pipeline:${name}`);
      const transformContext = createTransformContext(context, event);
      const startedAt = performance.now();
      const telemetry = getPipelineTelemetry();
      let status = "success";

      return await telemetry.startActiveSpan(
        "hooksmith.pipeline",
        {
          "hooksmith.event.type": event.type,
          "hooksmith.pipeline": name,
          "hooksmith.listener": listener.name ?? "listener",
          "hooksmith.transformation.count": transformations.length,
        },
        async (span) => {
          let current: unknown = event.data;

          try {
            log.debug(
              "Executing pipeline with {transformationCount} transformations",
              {
                transformationCount: transformations.length,
                listener: listener.name ?? "listener",
              },
            );

            for (let index = 0; index < transformations.length; index++) {
              const transformation = transformations[index];
              const ordinal = index + 1;
              const transformationName = "name" in transformation
                ? transformation.name
                : undefined;
              const identity = transformationName ?? `#${ordinal}`;

              log.trace("Executing transformation {transformation}", {
                transformation: identity,
                index: ordinal,
              });

              try {
                current = await transformation.transform(
                  current as never,
                  transformContext,
                );
              } catch (error) {
                const label = transformationName === undefined
                  ? `Transformation #${ordinal}`
                  : `Transformation "${transformationName}"`;
                const message = errorMessage(error);
                status = "failure";

                span.addEvent("hooksmith.transformation.failed", {
                  "hooksmith.transformation": identity,
                  "hooksmith.transformation.index": ordinal,
                });
                span.recordException(toException(error));
                span.setError(message);

                log.error(
                  "Transformation {transformation} failed",
                  {
                    transformation: identity,
                    index: ordinal,
                  },
                  error,
                );

                return {
                  success: false,
                  message: `${label} failed: ${message}`,
                  data: {
                    stage: "transform",
                    index: ordinal,
                    ...(transformationName === undefined
                      ? {}
                      : { name: transformationName }),
                    error: message,
                  },
                };
              }

              log.trace("Transformation {transformation} completed", {
                transformation: identity,
                index: ordinal,
              });
              span.addEvent("hooksmith.transformation.completed", {
                "hooksmith.transformation": identity,
                "hooksmith.transformation.index": ordinal,
              });
            }

            log.debug("Invoking terminal listener {listener}", {
              listener: listener.name ?? "listener",
            });
            const result = await listener.run(
              { ...event, data: current },
              context,
            );
            status = result.success ? "success" : "failure";
            span.setAttribute("hooksmith.status", status);
            if (!result.success) {
              span.setError();
            }

            log.debug("Pipeline completed with status {status}", { status });
            return result;
          } catch (error) {
            status = "error";
            span.recordException(toException(error));
            span.setError(errorMessage(error));
            throw error;
          } finally {
            span.setAttribute("hooksmith.status", status);
            telemetry.recordPipelineDuration(elapsedSeconds(startedAt), {
              "hooksmith.event.type": event.type,
              "hooksmith.pipeline": name,
              "hooksmith.status": status,
            });
            span.end();
          }
        },
      );
    },
  };
}

function isPipeOptions(value: unknown): value is PipeOptions {
  return typeof value === "object" && value !== null &&
    "name" in value && typeof value.name === "string" &&
    !("transform" in value) && !("run" in value);
}

function toException(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
