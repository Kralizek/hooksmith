import type { EventDocument } from "@hooksmith/core";
import type { HttpIngressContext } from "@hooksmith/core/ingress";
// @deno-types="@types/sns-validator"
import MessageValidator from "sns-validator";
import { mapSnsNotification } from "./mapping.ts";
import type { SnsNotification } from "./types.ts";

const validator = new MessageValidator();

/** Verifies and maps an Amazon SNS HTTP delivery into a Hooksmith event document. */
export async function fromSnsHttp<TData = unknown>(
  context: HttpIngressContext,
): Promise<EventDocument<TData>> {
  const notification = parseSnsNotification(context.request.body);

  await validateSnsMessage(notification);
  return mapSnsNotification<TData>(notification);
}

function parseSnsNotification(body: Uint8Array): SnsNotification {
  let payload: unknown;

  try {
    payload = JSON.parse(new TextDecoder().decode(body));
  } catch (error) {
    throw new TypeError("Invalid Amazon SNS webhook payload: expected JSON.", {
      cause: error,
    });
  }

  if (
    payload === null || typeof payload !== "object" || Array.isArray(payload)
  ) {
    throw new TypeError(
      "Invalid Amazon SNS webhook payload: expected a JSON object.",
    );
  }

  return payload as SnsNotification;
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
