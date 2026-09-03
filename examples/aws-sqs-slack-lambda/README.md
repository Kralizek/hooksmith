# SQS Lambda to Slack

This example shows a deployable Lambda-shaped Hooksmith composition: AWS Lambda
receives an SQS batch, Hooksmith processes each record independently, and each
successful item is sent to Slack.

```text
SQS batch
  ↓
@hooksmith/aws-lambda/sqs
  ↓ one record at a time
@hooksmith/aws/sqs
  ↓ EventDocument<QueueItem>
@hooksmith/aws-lambda processor
  ↓
Hooksmith runtime
  ↓
@hooksmith/slack
  ↓
Slack channel
```

Each SQS message body is expected to contain JSON like:

```json
{
  "text": "Deployment completed"
}
```

`fromSqs` turns the record into a Hooksmith event with type `aws.sqs.message`.
The runtime routes that event to the Slack listener, which uses the message
body's `text` property as the Slack message.

## Environment

The Lambda function needs these environment variables:

- `SLACK_BOT_TOKEN` — Slack bot token used by `@hooksmith/slack`.
- `SLACK_CHANNEL` — target Slack channel ID.

See the `@hooksmith/slack` package documentation for the Slack app and token
setup.

## SQS partial-batch behavior

The exported handler returns SQS `batchItemFailures`. Adapter, runtime, and
listener failures therefore fail only the affected record instead of replaying
the entire batch.

To make AWS honor that response, configure the SQS event source mapping with
`ReportBatchItemFailures` enabled. Without it, Lambda retries failures at batch
granularity.

`onRecordError` logs exceptions while preserving the partial-batch response.
Hooksmith reports that complete unsuccessfully are also returned as failed batch
items by `@hooksmith/aws-lambda/sqs`.

## Packaging

`handler.ts` exports the Lambda handler as `handler`. Package and deploy it
using your preferred Deno-on-Lambda approach, such as a Lambda container image
or a compatible custom runtime.

This example intentionally does not include infrastructure definitions so the
Hooksmith composition remains the focus.

## Validate

From this directory:

```sh
deno task check
```

The example has its own import map. AWS and Slack extensions come from their
published JSR packages while `@hooksmith/core` and `@hooksmith/runtime` point at
the local main-repo packages, so CI also checks compatibility between the main
repo and released external extensions.
