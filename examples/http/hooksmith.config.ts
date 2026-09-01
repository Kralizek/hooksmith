import type { Config } from "@hooksmith/core";
import { httpPost, jsonBody } from "@hooksmith/http";
import { eventType } from "@hooksmith/standard";

export default {
  routes: [
    {
      name: "publish-over-http",
      when: eventType("page.published"),
      listeners: [
        httpPost({
          url: "https://httpbin.org/anything/hooksmith",
          body: jsonBody((event) => ({
            type: event.type,
            subject: event.subject,
            metadata: event.metadata,
            data: event.data,
          })),
          expectStatus: 200,
          response: "json",
        }),
      ],
    },
  ],
} satisfies Config;
