import type { TransformContext, Transformer } from "@hooksmith/core";
import {
  executeRequest,
  resolve,
  unsuccessfulResponseMessage,
} from "./request.ts";
import type {
  FetchJsonOptions,
  JsonTransformerOptions,
  PostJsonOptions,
} from "./types.ts";

/** Fetches and parses a JSON response using an arbitrary HTTP method. */
export function fetchJson<
  TInput,
  TResponse,
  TOutput = TResponse,
>(
  options: FetchJsonOptions<TInput, TResponse, TOutput>,
): Transformer<TInput, TOutput> {
  return {
    name: options.name ?? `http-${options.method.toLowerCase()}-json`,
    async transform(input, context): Promise<TOutput> {
      const body = options.body === undefined
        ? undefined
        : await resolveJsonBody(options.body, input, context);
      const { response, report } = await executeRequest<
        TInput,
        TransformContext,
        TResponse
      >(input, context, {
        method: options.method,
        url: options.url,
        headers: options.headers,
        body,
        parser: "json",
      });

      if (!response.ok) {
        throw new Error(unsuccessfulResponseMessage(response));
      }

      return mapResponse(input, report.body as TResponse, options);
    },
  };
}

/** Fetches JSON with GET and replaces the current value with the mapped response. */
export function getJson<
  TInput,
  TResponse,
  TOutput = TResponse,
>(
  options: JsonTransformerOptions<TInput, TResponse, TOutput>,
): Transformer<TInput, TOutput> {
  return fetchJson({ ...options, method: "GET" });
}

/** Posts JSON and replaces the current value with the mapped JSON response. */
export function postJson<
  TInput,
  TResponse,
  TOutput = TResponse,
>(
  options: PostJsonOptions<TInput, TResponse, TOutput>,
): Transformer<TInput, TOutput> {
  return fetchJson({
    ...options,
    method: "POST",
    body: options.body ?? ((input: TInput) => input),
  });
}

async function resolveJsonBody<TInput>(
  value: NonNullable<FetchJsonOptions<TInput, unknown>["body"]>,
  input: TInput,
  context: TransformContext,
) {
  const resolved = await resolve(value, input, context);
  return {
    contentType: "application/json",
    resolve() {
      return JSON.stringify(resolved);
    },
  };
}

async function mapResponse<TInput, TResponse, TOutput>(
  input: TInput,
  response: TResponse,
  options: JsonTransformerOptions<TInput, TResponse, TOutput>,
): Promise<TOutput> {
  return options.map
    ? await options.map(input, response)
    : response as unknown as TOutput;
}
