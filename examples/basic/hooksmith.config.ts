import type { Config } from "@hooksmith/core";

export default {
  routes: [
    {
      name: "published-pages",
      when: {
        name: "is-page-published",
        evaluate: (event) => event.type === "page.published",
      },
      listeners: [
        {
          name: "log-publication",
          run(event, { log }) {
            log.info(
              `Published ${String(event.metadata?.url ?? event.subject?.id ?? "page")}`,
            );
            return {
              success: true,
              message: "Publication observed",
            };
          },
        },
      ],
    },
  ],
  fallback: [
    {
      name: "log-unhandled",
      run(event, { log }) {
        log.warn(`No route matched ${event.type}`);
        return { success: true, message: "Unhandled event recorded" };
      },
    },
  ],
} satisfies Config;
