# SQS Lambda to Slack and Teams

This example shows a deployable Lambda-shaped Hooksmith composition: AWS Lambda
receives an SQS batch, Hooksmith processes each record independently, enriches
the event with AWS execution and caller metadata, and routes matching items to
Slack or Teams.

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
Lambda environment + STS caller identity
  ↓
account == 1122334455
  ├─ region starts with eu- → Slack
  └─ region starts with us- → Teams
```

Each SQS message body is expected to contain JSON like:

```json
{
  "text": "Deployment completed"
}
```

`fromSqs` turns the record into a Hooksmith event with type `aws.sqs.message`.
Before routing, `lambdaEnvironmentEnrichment()` maps the Lambda region to
`metadata.awsRegion`, while `getCallerIdentityEnrichment()` maps the current AWS
account to `metadata.awsAccount`.

The routes then stay declarative. Both require account `1122334455`; European
regions go to Slack and US regions go to Teams:

```ts
const account = metadata("awsAccount", "1122334455");

when: all(account, regionStartsWith("eu-"));
when: all(account, regionStartsWith("us-"));
```

Events from other accounts do not match either route. Events from account
`1122334455` in regions outside the `eu-` and `us-` prefixes also remain
unmatched.

Both listeners consume the enriched metadata and send a message such as:

```text
Deployment completed · region=eu-north-1 · account=1122334455
```

This demonstrates both parts of enrichment: the enricher controls how external
AWS data is projected into Hooksmith metadata, and multiple route conditions can
use that metadata before any listener runs.

## Environment

The Lambda function needs these environment variables:

- `SLACK_BOT_TOKEN` — Slack bot token used by `@hooksmith/slack`.
- `SLACK_CHANNEL` — target Slack channel ID.
- `TEAMS_WORKFLOW_URL` — Teams Workflow webhook URL used by `@hooksmith/teams`.

The Lambda execution role also needs permission to call STS `GetCallerIdentity`.
AWS region and Lambda execution details are supplied by the Lambda environment
itself.

See the `@hooksmith/slack` and `@hooksmith/teams` package documentation for the
provider setup.

## SQS partial-batch behavior

The exported handler returns SQS `batchItemFailures`. Adapter, runtime,
enricher, and listener failures therefore fail only the affected record instead
of replaying the entire batch.

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

It also uses `@hooksmith/slack@^0.2.2` and `@hooksmith/teams@^0.2.2`, so the
resulting Hooksmith report identifies the provider listeners as `slack` and
`teams` rather than the underlying HTTP listeners.

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

The example has its own import map. AWS, Slack, and Teams extensions come from
their published JSR packages while `@hooksmith/core`, `@hooksmith/runtime`, and
`@hooksmith/standard` point at the local main-repo packages, so CI also checks
compatibility between the main repo and released external extensions.
