import type { Config, Event } from "@hooksmith/core";
import { expectStatus, httpPost, jsonBody } from "@hooksmith/http";
import { eventType } from "@hooksmith/standard";

interface HttpBinResponse {
  json: unknown;
  url: string;
}

export default {
  routes: [
    {
      name: "publish-over-http",
      when: eventType("page.published"),
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
