import type {
  Transformer,
  TransformContext,
} from "@hooksmith/core";
import {
  executeRequest,
  unsuccessfulResponseMessage,
} from "./request.ts";
import type {
  JsonTransformerOptions,
  PostJsonOptions,
} from "./types.ts";

/** Fetches JSON with GET and replaces the current value with the mapped response. */
export function getJson<
  TInput,
  TResponse,
  TOutput = TResponse,
>(
  options: JsonTransformerOptions<TInput, TResponse, TOutput>,
): Transformer<TInput, TOutput> {
  return jsonTransformer("GET", options);
}

/** Posts JSON and replaces the current value with the mapped JSON response. */
export function postJson<
  TInput,
  TResponse,
  TOutput = TResponse,
>(
  options: PostJsonOptions<TInput, TResponse, TOutput>,
): Transformer<TInput, TOutput> {
  return {
    name: options.name ?? "http-post-json",
    async transform(input, context): Promise<TOutput> {
      const bodyValue = options.body === undefined
        ? input
        : await resolveBody(options.body, input, context);

      const { response, report } = await executeRequest<
        TInput,
        TransformContext,
        TResponse
      >(input, context, {
        method: "POST",
        url: options.url,
        headers: options.headers,
        body: {
          contentType: "application/json",
          resolve() {
            return JSON.stringify(bodyValue);
          },
        },
        parser: "json",
      });

      if (!response.ok) {
        throw new Error(unsuccessfulResponseMessage(response));
      }

      const responseBody = report.body as TResponse;
      return options.map
        ? await options.map(input, responseBody)
        : responseBody as unknown as TOutput;
    },
  };
}

function jsonTransformer<
  TInput,
  TResponse,
  TOutput,
>(
  method: string,
  options: JsonTransformerOptions<TInput, TResponse, TOutput>,
): Transformer<TInput, TOutput> {
  return {
    name: options.name ?? `http-${method.toLowerCase()}-json`,
    async transform(input, context): Promise<TOutput> {
      const { response, report } = await executeRequest<
        TInput,
        TransformContext,
        TResponse
      >(input, context, {
        method,
        url: options.url,
        headers: options.headers,
        parser: "json",
      });

      if (!response.ok) {
        throw new Error(unsuccessfulResponseMessage(response));
      }

      const responseBody = report.body as TResponse;
      return options.map
        ? await options.map(input, responseBody)
        : responseBody as unknown as TOutput;
    },
  };
}

async function resolveBody<TInput>(
  value: NonNullable<PostJsonOptions<TInput, unknown>["body"]>,
  input: TInput,
  context: TransformContext,
): Promise<unknown> {
  return typeof value === "function"
    ? await value(input, context)
    : value;
}
