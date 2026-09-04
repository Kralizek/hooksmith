import type {
  Context,
  Event,
  EventEnricher,
  EventEnrichment,
} from "@hooksmith/core";
import { executeRequest, unsuccessfulResponseMessage } from "./request.ts";
import type { GetEnrichmentOptions } from "./types.ts";

/** Fetches JSON with GET and maps the response to event enrichment. */
export function getEnrichment<
  TEvent extends Event = Event,
  TResponse = EventEnrichment,
>(
  options: GetEnrichmentOptions<TEvent, TResponse>,
): EventEnricher<TEvent> {
  return {
    name: options.name ?? "http-get-enrichment",
    async enrich(event, context): Promise<EventEnrichment> {
      const { response } = await executeRequest<TEvent, Context>(
        event,
        context,
        {
          method: "GET",
          url: options.url,
          headers: options.headers,
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
