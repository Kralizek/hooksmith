import type { Config, Event } from "@hooksmith/core";
import {
  expectStatus,
  getEnrichment,
  httpPost,
  jsonBody,
} from "@hooksmith/http";
import { all, eventType, metadata } from "@hooksmith/standard";

interface HttpBinResponse {
  json: unknown;
  url: string;
}

interface EnrichmentResponse {
  tenantPlan: string;
}

export default {
  enrichers: [
    getEnrichment<Event, EnrichmentResponse>({
      url: "https://httpbin.org/response-headers?tenantPlan=pro",
      map: (_event, response) => ({
        metadata: { tenantPlan: response.tenantPlan },
      }),
    }),
  ],
  routes: [
    {
      name: "publish-over-http",
      when: all(
        eventType("page.published"),
        metadata("tenantPlan", "pro"),
      ),
      listeners: [
        httpPost({
          url: "https://httpbin.org/anything/hooksmith",
          body: jsonBody((event: Event) => ({
            type: event.type,
            subject: event.subject,
            metadata: event.metadata,
            data: event.data,
          })),
          response: {
            parse: "json",
            success: expectStatus(200),
            successMap: ({ status, body }) => ({
              status,
              url: (body as HttpBinResponse).url,
              echoed: (body as HttpBinResponse).json,
            }),
          },
        }),
      ],
    },
  ],
} satisfies Config;
