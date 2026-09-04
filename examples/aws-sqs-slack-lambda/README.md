# SQS Lambda to Slack

This example shows a deployable Lambda-shaped Hooksmith composition: AWS Lambda
receives an SQS batch, Hooksmith processes each record independently, enriches
the event with AWS execution and caller metadata, and sends each successful item
to Slack.

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
  ↓ enrich before routing
@hooksmith/aws-lambda environment + @hooksmith/aws/sts
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
Before routing, `lambdaEnvironmentEnrichment()` adds Lambda execution metadata
under `metadata.aws`, while `getCallerIdentityEnrichment()` adds the current AWS
caller identity under `metadata.sts`.

The Slack listener then receives the enriched event and posts a message such as:

```text
Deployment completed · region=eu-north-1 · account=123456789012
```

This demonstrates that enrichers run once per event before route conditions and
listeners, so downstream behavior can use metadata obtained from the execution
environment or AWS APIs.

## Environment

The Lambda function needs these environment variables:

- `SLACK_BOT_TOKEN` — Slack bot token used by `@hooksmith/slack`.
- `SLACK_CHANNEL` — target Slack channel ID.

The Lambda execution role also needs permission to call STS
`GetCallerIdentity`. AWS region and Lambda execution details are supplied by the
Lambda environment itself.

See the `@hooksmith/slack` package documentation for the Slack app and token
setup.

## SQS partial-batch behavior

The exported handler returns SQS `batchItemFailures`. Adapter, runtime, enricher,
and listener failures therefore fail only the affected record instead of
replaying the entire batch.

To make AWS honor that response, configure the SQS event source mapping with
`ReportBatchItemFailures` enabled. Without it, Lambda retries failures at batch
granularity.

Reader and processor exceptions are logged through the supplied Hooksmith
`Context` by default while preserving the partial-batch response. Hooksmith
reports that complete unsuccessfully are also returned as failed batch items by
`@hooksmith/aws-lambda/sqs`.

## Versions

The example targets the published AWS integration packages from the `0.3` line:

- `@hooksmith/aws@^0.3.0`
- `@hooksmith/aws-lambda@^0.3.0`

It also uses `@hooksmith/slack@^0.2.2`, so the resulting Hooksmith report identifies
the Slack listener as `slack` rather than the underlying HTTP listener.

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
