import { assertEquals, assertInstanceOf, assertRejects } from "@std/assert";
import { mapSnsNotification } from "./mapping.ts";
import { fromSnsHttp } from "./sns.ts";

Deno.test("fromSnsHttp rejects invalid JSON with SNS context", async () => {
  const error = await assertRejects(
    () =>
      fromSnsHttp({
        request: {
          method: "POST",
          url: "https://example.com/events",
          headers: new Headers(),
          body: new TextEncoder().encode("not-json"),
        },
      }),
    TypeError,
    "Invalid Amazon SNS webhook payload: expected JSON.",
  );

  assertInstanceOf(error.cause, SyntaxError);
});

Deno.test("fromSnsHttp rejects unsigned SNS HTTP deliveries", async () => {
  const body = new TextEncoder().encode(JSON.stringify({
    Type: "Notification",
    MessageId: "message-1",
    TopicArn: "arn:aws:sns:eu-north-1:123:orders",
    Message: "hello",
    Timestamp: "2026-09-07T12:00:00Z",
  }));

  await assertRejects(() =>
    fromSnsHttp({
      request: {
        method: "POST",
        url: "https://example.com/events",
        headers: new Headers(),
        body,
      },
    })
  );
});

Deno.test("mapSnsNotification maps SNS fields into EventDocument", () => {
  const document = mapSnsNotification<{ orderId: string }>({
    Type: "Notification",
    MessageId: "message-1",
    TopicArn: "arn:aws:sns:eu-north-1:123:orders",
    Subject: "Order created",
    Message: JSON.stringify({ orderId: "order-42" }),
    Timestamp: "2026-09-07T12:00:00Z",
    SignatureVersion: "1",
    Signature: "signature",
    SigningCertURL: "https://sns.eu-north-1.amazonaws.com/cert.pem",
    UnsubscribeURL: "https://sns.eu-north-1.amazonaws.com/unsubscribe",
    MessageAttributes: {
      tenant: { Type: "String", Value: "tenant-1" },
      attempts: 2,
    },
  });

  assertEquals(document, {
    type: "aws.sns.notification",
    timestamp: "2026-09-07T12:00:00Z",
    source: {
      kind: "aws.sns",
      id: "arn:aws:sns:eu-north-1:123:orders",
    },
    subject: {
      kind: "aws.sns.message",
      id: "message-1",
    },
    metadata: {
      tenant: "tenant-1",
      attempts: 2,
      sns: {
        notificationType: "Notification",
        subject: "Order created",
        signatureVersion: "1",
        signature: "signature",
        signingCertUrl: "https://sns.eu-north-1.amazonaws.com/cert.pem",
        unsubscribeUrl: "https://sns.eu-north-1.amazonaws.com/unsubscribe",
      },
    },
    data: { orderId: "order-42" },
  });
});
