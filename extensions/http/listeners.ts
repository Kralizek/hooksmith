import type { Event, Listener, ListenerResult } from "@hooksmith/core";
import { executeRequest, unsuccessfulResponseMessage } from "./request.ts";
import type {
  HttpRequestOptions,
  HttpResponse,
  HttpResponseOptions,
} from "./types.ts";

export function httpRequest<TEvent extends Event = Event>(
  options: HttpRequestOptions<TEvent>,
): Listener<TEvent> {
  return {
    name: options.name ?? `http-${(options.method ?? "GET").toLowerCase()}`,
    async run(event, context): Promise<ListenerResult> {
      const responseOptions = normalizeResponse(options.response);
      const { response, report } = await executeRequest(event, context, {
        method: options.method ?? "GET",
        url: options.url,
        headers: options.headers,
        body: options.body,
        parser: responseOptions.parse ?? "none",
      });

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

export function httpPut<TEvent extends Event = Event>(
  options: Omit<HttpRequestOptions<TEvent>, "method">,
): Listener<TEvent> {
  return httpRequest({ ...options, method: "PUT" });
}

export function httpDelete<TEvent extends Event = Event>(
  options: Omit<HttpRequestOptions<TEvent>, "method">,
): Listener<TEvent> {
  return httpRequest({ ...options, method: "DELETE" });
}

function normalizeResponse<TEvent extends Event>(
  response: HttpResponse<TEvent> | undefined,
): HttpResponseOptions<TEvent> {
  if (response === undefined) return {};
  return typeof response === "function" ? { success: response } : response;
}
