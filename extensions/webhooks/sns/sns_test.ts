import { assertRejects } from "@std/assert";
import { fromSnsHttp } from "./sns.ts";

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
