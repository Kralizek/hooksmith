import type {
  Context,
  Event,
  Listener,
  ListenerResult,
  Transformer,
  TransformContext,
} from "@hooksmith/core";

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

/** Deferred HTTP request body resolved for the current Hooksmith event. */
export interface HttpBody<TEvent extends Event = Event> {
  contentType?: string;
  resolve(
    event: TEvent,
    context: Context,
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
  method?: string;
  url: ValueOrFactory<string | URL, TEvent>;
  headers?: HeaderSource<TEvent> | readonly HeaderSource<TEvent>[];
  body?: ValueOrFactory<BodyInit | null, TEvent> | HttpBody<TEvent>;
  response?: HttpResponse<TEvent>;
}

/** Shared options used by JSON-returning HTTP transformers. */
export interface JsonTransformerOptions<TInput> {
  name?: string;
  url: ValueOrFactory<string | URL, TInput, TransformContext>;
  headers?:
    | HeaderSource<TInput, TransformContext>
    | readonly HeaderSource<TInput, TransformContext>[];
}

/** Options used by {@link postJson}. */
export interface PostJsonOptions<TInput> extends JsonTransformerOptions<TInput> {
  body?: ValueOrFactory<unknown, TInput, TransformContext>;
}

export function headers<TInput = Event, TContext extends Context = Context>(
  ...sources: HeaderSource<TInput, TContext>[]
): HeaderSource<TInput, TContext>[] {
  return sources;
}

export function bearerAuth<
  TInput = Event,
  TContext extends Context = Context,
>(
  token: ValueOrFactory<string, TInput, TContext>,
): HeaderSource<TInput, TContext> {
  return async (input, context) => ({
    Authorization: `Bearer ${await resolve(token, input, context)}`,
  });
}

export function basicAuth<
  TInput = Event,
  TContext extends Context = Context,
>(
  username: ValueOrFactory<string, TInput, TContext>,
  password: ValueOrFactory<string, TInput, TContext>,
): HeaderSource<TInput, TContext> {
  return async (input, context) => {
    const user = await resolve(username, input, context);
    const pass = await resolve(password, input, context);
    return { Authorization: `Basic ${btoa(`${user}:${pass}`)}` };
  };
}

export function jsonBody<TEvent extends Event = Event>(
  value: ValueOrFactory<unknown, TEvent>,
): HttpBody<TEvent> {
  return {
    contentType: "application/json",
    async resolve(event, context) {
      return JSON.stringify(await resolve(value, event, context));
    },
  };
}

export function formBody<TEvent extends Event = Event>(
  value: ValueOrFactory<URLSearchParams | Record<string, string>, TEvent>,
): HttpBody<TEvent> {
  return {
    contentType: "application/x-www-form-urlencoded",
    async resolve(event, context) {
      const resolved = await resolve(value, event, context);
      return resolved instanceof URLSearchParams
        ? resolved.toString()
        : new URLSearchParams(resolved).toString();
    },
  };
}

export function textBody<TEvent extends Event = Event>(
  value: ValueOrFactory<string, TEvent>,
  contentType = "text/plain; charset=utf-8",
): HttpBody<TEvent> {
  return {
    contentType,
    resolve(event, context) {
      return resolve(value, event, context);
    },
  };
}

export function expectStatus<TEvent extends Event = Event>(
  ...expected: number[]
): HttpResponseSuccess<TEvent> {
  if (expected.length === 0) {
    throw new TypeError("expectStatus requires at least one status code");
  }
  return ({ status }) => expected.includes(status);
}

export function httpRequest<TEvent extends Event = Event>(
  options: HttpRequestOptions<TEvent>,
): Listener<TEvent> {
  return {
    name: `http-${(options.method ?? "GET").toLowerCase()}`,
    async run(event, context): Promise<ListenerResult> {
      const url = await resolve(options.url, event, context);
      const requestHeaders = await resolveHeaders(
        options.headers,
        event,
        context,
      );
      let body: BodyInit | null | undefined;

      if (options.body && isHttpBody(options.body)) {
        body = await options.body.resolve(event, context);
        if (options.body.contentType && !requestHeaders.has("Content-Type")) {
          requestHeaders.set("Content-Type", options.body.contentType);
        }
      } else if (options.body !== undefined) {
        body = await resolve(options.body, event, context);
      }

      const responseOptions = normalizeResponse(options.response);
      const { response, report } = await sendRequest(
        url,
        options.method ?? "GET",
        requestHeaders,
        body,
        responseOptions.parse ?? "none",
      );
      const success = responseOptions.success
        ? await responseOptions.success(report, event, context)
        : response.ok;
      const mapper = success
        ? responseOptions.successMap
        : responseOptions.errorMap;
      const data = mapper ? await mapper(report, event, context) : report;

      return {
        success,
        message: success
          ? `${response.status} ${response.statusText}`.trim()
          : unsuccessfulResponseMessage(response),
        data,
      };
    },
  };
}

export function httpGet<TEvent extends Event = Event>(
  options: Omit<HttpRequestOptions<TEvent>, "method">,
): Listener<TEvent> {
  return httpRequest({ ...options, method: "GET" });
}

export function httpPost<TEvent extends Event = Event>(
  options: Omit<HttpRequestOptions<TEvent>, "method">,
): Listener<TEvent> {
  return httpRequest({ ...options, method: "POST" });
}

/** Fetches JSON with GET and replaces the current value with the response body. */
export function getJson<TInput, TOutput>(
  options: JsonTransformerOptions<TInput>,
): Transformer<TInput, TOutput> {
  return {
    name: options.name ?? "http-get-json",
    async transform(input, context): Promise<TOutput> {
      const url = await resolve(options.url, input, context);
      const requestHeaders = await resolveHeaders(
        options.headers,
        input,
        context,
      );
      const { response, report } = await sendRequest(
        url,
        "GET",
        requestHeaders,
        undefined,
        "json",
      );

      if (!response.ok) {
        throw new Error(unsuccessfulResponseMessage(response));
      }

      return report.body as TOutput;
    },
  };
}

/** Posts JSON and replaces the current value with the JSON response body. */
export function postJson<TInput, TOutput>(
  options: PostJsonOptions<TInput>,
): Transformer<TInput, TOutput> {
  return {
    name: options.name ?? "http-post-json",
    async transform(input, context): Promise<TOutput> {
      const url = await resolve(options.url, input, context);
      const requestHeaders = await resolveHeaders(
        options.headers,
        input,
        context,
      );
      if (!requestHeaders.has("Content-Type")) {
        requestHeaders.set("Content-Type", "application/json");
      }

      const value = options.body === undefined
        ? input
        : await resolve(options.body, input, context);
      const body = JSON.stringify(value);
      const { response, report } = await sendRequest(
        url,
        "POST",
        requestHeaders,
        body,
        "json",
      );

      if (!response.ok) {
        throw new Error(unsuccessfulResponseMessage(response));
      }

      return report.body as TOutput;
    },
  };
}

async function resolve<T, TInput, TContext extends Context>(
  value: ValueOrFactory<T, TInput, TContext>,
  input: TInput,
  context: TContext,
): Promise<T> {
  return typeof value === "function"
    ? await (value as (
      input: TInput,
      context: TContext,
    ) => T | Promise<T>)(input, context)
    : value;
}

async function resolveHeaders<TInput, TContext extends Context>(
  value:
    | HeaderSource<TInput, TContext>
    | readonly HeaderSource<TInput, TContext>[]
    | undefined,
  input: TInput,
  context: TContext,
): Promise<Headers> {
  const result = new Headers();
  if (value === undefined) return result;

  const sources = Array.isArray(value) ? value : [value];
  for (const source of sources) {
    const resolved = await resolve(source, input, context);
    new Headers(resolved).forEach((headerValue, key) =>
      result.set(key, headerValue)
    );
  }
  return result;
}

function normalizeResponse<TEvent extends Event>(
  response: HttpResponse<TEvent> | undefined,
): HttpResponseOptions<TEvent> {
  if (response === undefined) return {};
  return typeof response === "function" ? { success: response } : response;
}

function isHttpBody<TEvent extends Event>(
  value: unknown,
): value is HttpBody<TEvent> {
  return typeof value === "object" &&
    value !== null &&
    "resolve" in value &&
    typeof (value as { resolve?: unknown }).resolve === "function";
}

async function sendRequest(
  url: string | URL,
  method: string,
  headers: Headers,
  body: BodyInit | null | undefined,
  parser: ResponseParser,
): Promise<{ response: Response; report: HttpResponseReport }> {
  const response = await fetch(url, { method, headers, body });
  const report = await toReport(response, parser);
  return { response, report };
}

function unsuccessfulResponseMessage(response: Response): string {
  return `HTTP response considered unsuccessful: ${response.status} ${response.statusText}`
    .trim();
}

async function toReport(
  response: Response,
  parser: ResponseParser,
): Promise<HttpResponseReport> {
  const report: HttpResponseReport = {
    status: response.status,
    statusText: response.statusText,
    headers: Object.fromEntries(response.headers.entries()),
  };

  if (parser === "text") report.body = await response.text();
  if (parser === "json") report.body = await response.json();
  return report;
}
