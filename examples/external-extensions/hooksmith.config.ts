import type { Config, Event } from "@hooksmith/core";
import { post } from "@hooksmith/bluesky";
import { sendMessage } from "@hooksmith/slack";
import { eventType } from "@hooksmith/standard";

interface PageData {
  title: string;
}

type PageEvent = Event<PageData>;

export default {
  routes: [{
    name: "announce-published-page",
    when: eventType<PageEvent>("page.published"),
    listeners: [
      post<PageEvent>({
        identifier: Deno.env.get("BLUESKY_IDENTIFIER")!,
        appPassword: Deno.env.get("BLUESKY_APP_PASSWORD")!,
        text: (event) => `${event.data.title}\n\n${event.metadata?.url}`,
      }),
      sendMessage<PageEvent>({
        token: Deno.env.get("SLACK_BOT_TOKEN")!,
        channel: Deno.env.get("SLACK_CHANNEL")!,
        text: (event) => `${event.data.title}\n\n${event.metadata?.url}`,
      }),
    ],
  }],
} satisfies Config<PageEvent>;
