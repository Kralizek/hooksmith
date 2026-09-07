import type { EventDocument } from "@hooksmith/core";
import type { HttpIngressContext } from "@hooksmith/core/ingress";
import MessageValidator from "npm:sns-validator@^0.3.5";
import type { SnsNotification } from "./types.ts";

const validator = new MessageValidator();

/** Verifies and maps an Amazon SNS HTTP delivery into a Hooksmith event document. */
export async function fromSnsHttp<TData = unknown>(
  context: HttpIngressContext,
): Promise<EventDocument<TData>> {
  const notification = JSON.parse(
    new TextDecoder().decode(context.request.body),
  ) as SnsNotification;

  await validateSnsMessage(notification);
  return mapSnsNotification<TData>(notification);
}

function validateSnsMessage(notification: SnsNotification): Promise<void> {
  return new Promise((resolve, reject) => {
    validator.validate(notification, (error: Error | null) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

function mapSnsNotification<TData>(
  notification: SnsNotification,
): EventDocument<TData> {
  assertReservedMetadataKeyAvailable(notification.MessageAttributes, "sns");

  return {
    type: eventType(notification.Type),
    timestamp: Temporal.Instant.from(notification.Timestamp).toString(),
    source: {
      kind: "aws.sns",
      id: notification.TopicArn,
    },
    subject: {
      kind: "aws.sns.message",
      id: notification.MessageId,
    },
    metadata: compact({
      ...readMessageAttributes(notification.MessageAttributes),
      sns: compact({
        notificationType: notification.Type,
        subject: notification.Subject,
        signatureVersion: notification.SignatureVersion,
        signature: notification.Signature,
        signingCertUrl: notification.SigningCertURL,
        unsubscribeUrl: notification.UnsubscribeURL,
        subscribeUrl: notification.SubscribeURL,
        token: notification.Token,
      }),
    }),
    data: parsePayload(notification.Message) as TData,
  };
}

function parsePayload(payload: string): unknown {
  try {
    return JSON.parse(payload);
  } catch {
    return payload;
  }
}

function eventType(type: string): string {
  switch (type) {
    case "Notification":
      return "aws.sns.notification";
    case "SubscriptionConfirmation":
      return "aws.sns.subscription-confirmation";
    case "UnsubscribeConfirmation":
      return "aws.sns.unsubscribe-confirmation";
    default:
      return `aws.sns.${type}`;
  }
}

function readMessageAttributes(
  attributes: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (attributes === undefined) return {};

  return Object.fromEntries(
    Object.entries(attributes).map(([key, attribute]) => [
      key,
      readMessageAttribute(attribute),
    ]),
  );
}

function readMessageAttribute(attribute: unknown): unknown {
  if (attribute === null || typeof attribute !== "object") return attribute;

  const value = attribute as Record<string, unknown>;
  return value.Value ?? attribute;
}

function assertReservedMetadataKeyAvailable(
  attributes: Record<string, unknown> | undefined,
  key: string,
): void {
  if (attributes !== undefined && key in attributes) {
    throw new Error(
      `SNS message attribute "${key}" conflicts with reserved Hooksmith metadata key "${key}".`,
    );
  }
}

function compact(
  values: Record<string, unknown>,
): Record<string, unknown> | undefined {
  const entries = Object.entries(values).filter(([, value]) =>
    value !== undefined
  );
  return entries.length === 0 ? undefined : Object.fromEntries(entries);
}
