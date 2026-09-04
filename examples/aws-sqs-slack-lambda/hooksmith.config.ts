import type { Config, Event } from "@hooksmith/core";
import { getCallerIdentityEnrichment } from "@hooksmith/aws/sts";
import { lambdaEnvironmentEnrichment } from "@hooksmith/aws-lambda";
import { sendMessage } from "@hooksmith/slack";

interface QueueItem {
  text: string;
}

const slackBotToken = requiredEnv("SLACK_BOT_TOKEN");
const slackChannel = requiredEnv("SLACK_CHANNEL");

export default {
  enrichers: [
    lambdaEnvironmentEnrichment<Event<QueueItem>>(),
    getCallerIdentityEnrichment<Event<QueueItem>>(),
  ],
  routes: [{
    name: "forward-sqs-message-to-slack",
    listeners: [
      sendMessage<Event<QueueItem>>({
        token: slackBotToken,
        channel: slackChannel,
        text: (event) => enrichedMessage(event),
      }),
    ],
  }],
} satisfies Config<Event<QueueItem>>;

function enrichedMessage(event: Event<QueueItem>): string {
  const aws = event.metadata?.aws as
    | { region?: string }
    | undefined;
  const sts = event.metadata?.sts as
    | { account?: string }
    | undefined;

  return [
    event.data.text,
    aws?.region === undefined ? undefined : `region=${aws.region}`,
    sts?.account === undefined ? undefined : `account=${sts.account}`,
  ].filter((value): value is string => value !== undefined).join(" · ");
}

function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (value === undefined || value.length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}
