import type { Config, Event } from "@hooksmith/core";
import { post } from "@hooksmith/bluesky";
import { sendMessage } from "@hooksmith/slack";
import { eventType } from "@hooksmith/standard";

interface PageData {
  title: string;
}

type PageEvent = Event<PageData>;

const blueskyIdentifier = requiredEnv("BLUESKY_IDENTIFIER");
const blueskyAppPassword = requiredEnv("BLUESKY_APP_PASSWORD");
const slackBotToken = requiredEnv("SLACK_BOT_TOKEN");
const slackChannel = requiredEnv("SLACK_CHANNEL");

export default {
  routes: [{
    name: "announce-published-page",
    when: eventType<PageEvent>("page.published"),
    listeners: [
      post<PageEvent>({
        identifier: blueskyIdentifier,
        appPassword: blueskyAppPassword,
        text: (event) => `${event.data.title}\n\n${event.metadata?.url}`,
      }),
      sendMessage<PageEvent>({
        token: slackBotToken,
        channel: slackChannel,
        text: (event) => `${event.data.title}\n\n${event.metadata?.url}`,
      }),
    ],
  }],
} satisfies Config<PageEvent>;

function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (value === undefined || value.length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}
