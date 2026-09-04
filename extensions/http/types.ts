import type { Context, Event, TransformContext } from "@hooksmith/core";

/** Fixed value or input-aware factory resolved when an HTTP operation runs. */
export type ValueOrFactory<
  T,
  TInput = Event,
  TContext extends Context = Context,
> =
  | T
  | ((input: TInput, context: TContext) => T | Promise<T>);

/** Header values or an input-aware factory that produces them. */
export type HeaderSource<
  TInput = Event,
  TContext extends Context = Context,
> = ValueOrFactory<HeadersInit, TInput, TContext>;

/** Deferred HTTP request body resolved for the current input. */
export interface HttpBody<
  TInput = Event,
  TContext extends Context = Context,
> {
  contentType?: string;
  resolve(
    input: TInput,
    context: TContext,
  ): BodyInit | null | Promise<BodyInit | null>;
}

/** Built-in response body parsing modes. */
export type ResponseParser = "none" | "text" | "json";

/** Normalized HTTP response exposed to success checks and response mappers. */
export interface HttpResponseReport<TBody = unknown> {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body?: TBody;
}

/** Predicate that determines whether an HTTP response is successful. */
export type HttpResponseSuccess<TEvent extends Event = Event> = (
  response: HttpResponseReport,
  event: TEvent,
  context: Context,
) => boolean | Promise<boolean>;

/** Response parsing, success evaluation, and result-mapping options. */
export interface HttpResponseOptions<TEvent extends Event = Event> {
  parse?: ResponseParser;
  success?: HttpResponseSuccess<TEvent>;
  successMap?: (
    response: HttpResponseReport,
    event: TEvent,
    context: Context,
  ) => unknown | Promise<unknown>;
  errorMap?: (
    response: HttpResponseReport,
    event: TEvent,
    context: Context,
  ) => unknown | Promise<unknown>;
}

/** Shorthand response predicate or full response configuration. */
export type HttpResponse<TEvent extends Event = Event> =
  | HttpResponseSuccess<TEvent>
  | HttpResponseOptions<TEvent>;

/** Options used to create a Hooksmith HTTP request listener. */
export interface HttpRequestOptions<TEvent extends Event = Event> {
  name?: string;
  method?: string;
  url: ValueOrFactory<string | URL, TEvent>;
  headers?: HeaderSource<TEvent> | readonly HeaderSource<TEvent>[];
  body?: ValueOrFactory<BodyInit | null, TEvent> | HttpBody<TEvent>;
  response?: HttpResponse<TEvent>;
}

/** Maps an HTTP JSON response and its input to the next transformation value. */
export type JsonResponseMap<TInput, TResponse, TOutput> = (
  input: TInput,
  response: TResponse,
) => TOutput | Promise<TOutput>;

/** Shared options used by JSON-returning HTTP transformers. */
export interface JsonTransformerOptions<
  TInput,
  TResponse,
  TOutput = TResponse,
> {
  name?: string;
  url: ValueOrFactory<string | URL, TInput, TransformContext>;
  headers?:
    | HeaderSource<TInput, TransformContext>
    | readonly HeaderSource<TInput, TransformContext>[];
  map?: JsonResponseMap<TInput, TResponse, TOutput>;
}

/** Options used by fetchJson. */
export interface FetchJsonOptions<
  TInput,
  TResponse,
  TOutput = TResponse,
> extends JsonTransformerOptions<TInput, TResponse, TOutput> {
  method: string;
  body?: ValueOrFactory<unknown, TInput, TransformContext>;
}

/** Options used by postJson. */
export interface PostJsonOptions<
  TInput,
  TResponse,
  TOutput = TResponse,
> extends JsonTransformerOptions<TInput, TResponse, TOutput> {
  body?: ValueOrFactory<unknown, TInput, TransformContext>;
}
