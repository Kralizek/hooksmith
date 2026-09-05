import type { Context, Logger } from "@hooksmith/core";
import type {
  HeaderSource,
  HttpBody,
  HttpResponseReport,
  ResponseParser,
  ValueOrFactory,
} from "./types.ts";

/** Low-level HTTP request execution options shared by listeners and transformers. */
export interface HttpExecutionOptions<
  TInput,
  TContext extends Context,
> {
  method: string;
  url: ValueOrFactory<string | URL, TInput, TContext>;
  headers?:
    | HeaderSource<TInput, TContext>
    | readonly HeaderSource<TInput, TContext>[];
  body?:
    | ValueOrFactory<BodyInit | null, TInput, TContext>
    | HttpBody<TInput, TContext>;
  parser: ResponseParser;
}

/** Raw fetch response together with its normalized Hooksmith response report. */
export interface HttpExecutionResult<TBody = unknown> {
  response: Response;
  report: HttpResponseReport<TBody>;
}

export async function executeRequest<
  TInput,
  TContext extends Context,
  TBody = unknown,
>(
  input: TInput,
  context: TContext,
  log: Logger,
  options: HttpExecutionOptions<TInput, TContext>,
): Promise<HttpExecutionResult<TBody>> {
  const url = await resolve(options.url, input, context);
  const headers = await resolveHeaders(options.headers, input, context);
  let body: BodyInit | null | undefined;

  if (options.body && isHttpBody<TInput, TContext>(options.body)) {
    body = await options.body.resolve(input, context);
    if (options.body.contentType && !headers.has("Content-Type")) {
      headers.set("Content-Type", options.body.contentType);
    }
  } else if (options.body !== undefined) {
    body = await resolve(options.body, input, context);
  }

  log.debug("Sending {method} request to {url}", {
    method: options.method,
    url: url.toString(),
  });

  const response = await fetch(url, {
    method: options.method,
    headers,
    body,
  });

  log.debug("Received HTTP {status} from {url}", {
    method: options.method,
    url: url.toString(),
    status: response.status,
    statusText: response.statusText,
  });

  return {
    response,
    report: await toReport<TBody>(response, options.parser),
  };
}

export async function resolve<T, TInput, TContext extends Context>(
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

export function unsuccessfulResponseMessage(response: Response): string {
  return `HTTP response considered unsuccessful: ${response.status} ${response.statusText}`
    .trim();
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

function isHttpBody<TInput, TContext extends Context>(
  value: unknown,
): value is HttpBody<TInput, TContext> {
  return typeof value === "object" &&
    value !== null &&
    "resolve" in value &&
    typeof (value as { resolve?: unknown }).resolve === "function";
}

async function toReport<TBody>(
  response: Response,
  parser: ResponseParser,
): Promise<HttpResponseReport<TBody>> {
  const report: HttpResponseReport<TBody> = {
    status: response.status,
    statusText: response.statusText,
    headers: Object.fromEntries(response.headers.entries()),
  };

  if (parser === "text") report.body = await response.text() as TBody;
  if (parser === "json") report.body = await response.json() as TBody;
  return report;
}
