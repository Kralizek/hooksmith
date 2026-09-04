import type { Config, Event } from "@hooksmith/core";
import { getCallerIdentityEnrichment } from "@hooksmith/aws/sts";
import { lambdaEnvironmentEnrichment } from "@hooksmith/aws-lambda";
import { sendMessage } from "@hooksmith/slack";
import { metadata } from "@hooksmith/standard";

interface QueueItem {
  text: string;
}

const slackBotToken = requiredEnv("SLACK_BOT_TOKEN");
const slackChannel = requiredEnv("SLACK_CHANNEL");

export default {
  enrichers: [
    lambdaEnvironmentEnrichment<Event<QueueItem>>({
      map: (_event, environment) => ({
        metadata: { awsRegion: environment.region },
      }),
    }),
    getCallerIdentityEnrichment<Event<QueueItem>>({
      map: (_event, response) => ({
        metadata: { awsAccount: response.Account },
      }),
    }),
  ],
  routes: [{
    name: "forward-eu-north-1-sqs-message-to-slack",
    when: metadata("awsRegion", "eu-north-1"),
    listeners: [
      sendMessage<Event<QueueItem>>({
        token: slackBotToken,
        channel: slackChannel,
        text: (event) =>
          `${event.data.text} · account=${String(event.metadata?.awsAccount)}`,
      }),
    ],
  }],
} satisfies Config<Event<QueueItem>>;

function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (value === undefined || value.length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}
