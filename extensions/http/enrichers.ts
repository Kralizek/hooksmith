import type {
  Context,
  Event,
  EventEnricher,
  EventEnrichment,
} from "@hooksmith/core";
import { jsonBody } from "./helpers.ts";
import { executeRequest, unsuccessfulResponseMessage } from "./request.ts";
import type {
  FetchEnrichmentOptions,
  GetEnrichmentOptions,
} from "./types.ts";

/** Fetches JSON with an arbitrary HTTP method and maps it to event enrichment. */
export function fetchEnrichment<
  TEvent extends Event = Event,
  TResponse = EventEnrichment,
>(
  options: FetchEnrichmentOptions<TEvent, TResponse>,
): EventEnricher<TEvent> {
  return {
    name: options.name ?? `http-${options.method.toLowerCase()}-enrichment`,
    async enrich(event, context): Promise<EventEnrichment> {
      const body = options.body === undefined
        ? undefined
        : jsonBody<TEvent>(options.body);
      const { response } = await executeRequest<TEvent, Context>(
        event,
        context,
        {
          method: options.method,
          url: options.url,
          headers: options.headers,
          body,
          parser: "none",
        },
      );

      if (!response.ok) {
        throw new Error(unsuccessfulResponseMessage(response));
      }

      const responseBody = await response.json() as TResponse;
      return options.map
        ? await options.map(event, responseBody, context)
        : responseBody as unknown as EventEnrichment;
    },
  };
}

/** Fetches JSON with GET and maps it to event enrichment. */
export function getEnrichment<
  TEvent extends Event = Event,
  TResponse = EventEnrichment,
>(
  options: GetEnrichmentOptions<TEvent, TResponse>,
): EventEnricher<TEvent> {
  return fetchEnrichment({ ...options, method: "GET" });
}
