import type { Config, Event } from "@hooksmith/core";
import { sendMessage } from "@hooksmith/slack";

export interface QueueItem {
  text: string;
}

export type QueueItemEvent = Event<QueueItem>;

const slackBotToken = requiredEnv("SLACK_BOT_TOKEN");
const slackChannel = requiredEnv("SLACK_CHANNEL");

export default {
  routes: [{
    name: "forward-sqs-message-to-slack",
    listeners: [
      sendMessage<QueueItemEvent>({
        token: slackBotToken,
        channel: slackChannel,
        text: (event) => event.data.text,
      }),
    ],
  }],
} satisfies Config<QueueItemEvent>;

function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (value === undefined || value.length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}
