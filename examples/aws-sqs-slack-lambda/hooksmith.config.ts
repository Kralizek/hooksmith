import type { Config, Event } from "@hooksmith/core";
import { getCallerIdentityEnrichment } from "@hooksmith/aws/sts";
import { lambdaEnvironmentEnrichment } from "@hooksmith/aws-lambda";
import { sendMessage as sendSlackMessage } from "@hooksmith/slack";
import { all, metadata } from "@hooksmith/standard";
import { sendMessage as sendTeamsMessage } from "@hooksmith/teams";

interface QueueItem {
  text: string;
}

const slackBotToken = requiredEnv("SLACK_BOT_TOKEN");
const slackChannel = requiredEnv("SLACK_CHANNEL");
const teamsWorkflowUrl = requiredEnv("TEAMS_WORKFLOW_URL");

const account = metadata("awsAccount", "1122334455");
const regionStartsWith = (prefix: string) =>
  metadata(
    "awsRegion",
    (value) => typeof value === "string" && value.startsWith(prefix),
  );

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
  routes: [
    {
      name: "forward-eu-sqs-message-to-slack",
      when: all(account, regionStartsWith("eu-")),
      listeners: [
        sendSlackMessage<Event<QueueItem>>({
          token: slackBotToken,
          channel: slackChannel,
          text: (event) => enrichedMessage(event),
        }),
      ],
    },
    {
      name: "forward-us-sqs-message-to-teams",
      when: all(account, regionStartsWith("us-")),
      listeners: [
        sendTeamsMessage<Event<QueueItem>>({
          workflowUrl: teamsWorkflowUrl,
          text: (event) => enrichedMessage(event),
        }),
      ],
    },
  ],
} satisfies Config<Event<QueueItem>>;

function enrichedMessage(event: Event<QueueItem>): string {
  return [
    event.data.text,
    `region=${String(event.metadata?.awsRegion)}`,
    `account=${String(event.metadata?.awsAccount)}`,
  ].join(" · ");
}

function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (value === undefined || value.length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}
