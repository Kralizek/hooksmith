import type { Context, Event, Listener, ListenerResult } from "@hooksmith/core";

export type ValueOrFactory<T, TEvent extends Event = Event> =
  | T
  | ((event: TEvent, context: Context) => T | Promise<T>);

export type HeaderSource<TEvent extends Event = Event> = ValueOrFactory<
  HeadersInit,
  TEvent
>;

export interface HttpBody<TEvent extends Event = Event> {
  contentType?: string;
  resolve(
    event: TEvent,
    context: Context,
  ): BodyInit | null | Promise<BodyInit | null>;
}

export type StatusExpectation =
  | number
  | readonly number[]
  | ((status: number) => boolean);

export type ResponseMode = "none" | "text" | "json";

export interface HttpResponseReport<TBody = unknown> {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body?: TBody;
}

export interface HttpRequestOptions<TEvent extends Event = Event> {
  method?: string;
  url: ValueOrFactory<string | URL, TEvent>;
  headers?: HeaderSource<TEvent> | readonly HeaderSource<TEvent>[];
  body?: ValueOrFactory<BodyInit | null, TEvent> | HttpBody<TEvent>;
  expectStatus?: StatusExpectation;
  response?: ResponseMode;
}

export function headers<TEvent extends Event = Event>(
  ...sources: HeaderSource<TEvent>[]
): HeaderSource<TEvent>[] {
  return sources;
}

export function bearerAuth<TEvent extends Event = Event>(
  token: ValueOrFactory<string, TEvent>,
): HeaderSource<TEvent> {
  return async (event, context) => ({
    Authorization: `Bearer ${await resolve(token, event, context)}`,
  });
}

export function basicAuth<TEvent extends Event = Event>(
  username: ValueOrFactory<string, TEvent>,
  password: ValueOrFactory<string, TEvent>,
): HeaderSource<TEvent> {
  return async (event, context) => {
    const user = await resolve(username, event, context);
    const pass = await resolve(password, event, context);
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

      const response = await fetch(url, {
        method: options.method ?? "GET",
        headers: requestHeaders,
        body,
      });

      const success = matchesStatus(response.status, options.expectStatus);
      const data = await toReport(response, options.response ?? "none");

      return {
        success,
        message: success
          ? `${response.status} ${response.statusText}`.trim()
          : `Unexpected HTTP status ${response.status} ${response.statusText}`
            .trim(),
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

async function resolve<T, TEvent extends Event>(
  value: ValueOrFactory<T, TEvent>,
  event: TEvent,
  context: Context,
): Promise<T> {
  return typeof value === "function"
    ? await (value as (event: TEvent, context: Context) => T | Promise<T>)(
      event,
      context,
    )
    : value;
}

async function resolveHeaders<TEvent extends Event>(
  value: HttpRequestOptions<TEvent>["headers"],
  event: TEvent,
  context: Context,
): Promise<Headers> {
  const result = new Headers();
  if (value === undefined) return result;

  const sources = Array.isArray(value) ? value : [value];
  for (const source of sources) {
    const resolved = await resolve(source, event, context);
    new Headers(resolved).forEach((headerValue, key) =>
      result.set(key, headerValue)
    );
  }
  return result;
}

function isHttpBody<TEvent extends Event>(
  value: unknown,
): value is HttpBody<TEvent> {
  return typeof value === "object" && value !== null && "resolve" in value;
}

function matchesStatus(
  status: number,
  expectation?: StatusExpectation,
): boolean {
  if (expectation === undefined) return status >= 200 && status < 300;
  if (typeof expectation === "number") return status === expectation;
  if (typeof expectation === "function") return expectation(status);
  return expectation.includes(status);
}

async function toReport(
  response: Response,
  mode: ResponseMode,
): Promise<HttpResponseReport> {
  const report: HttpResponseReport = {
    status: response.status,
    statusText: response.statusText,
    headers: Object.fromEntries(response.headers.entries()),
  };

  if (mode === "text") report.body = await response.text();
  if (mode === "json") report.body = await response.json();
  return report;
}
