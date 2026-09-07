# @hooksmith/webhooks

Reusable HTTP webhook ingress mappers for Hooksmith.

Provider families are exposed through focused subpaths so their dependencies
stay isolated. The package root does not import provider implementations.

## Amazon SNS

`@hooksmith/webhooks/sns` verifies Amazon SNS HTTP/HTTPS deliveries and maps
them to Hooksmith `EventDocument` values.

```ts
import { fromSnsHttp } from "@hooksmith/webhooks/sns";

const document = await fromSnsHttp(context);
```

`fromSnsHttp` implements the shared `HttpIngressMapper` contract from
`@hooksmith/core/ingress`, so it can be used by any Hooksmith HTTP-capable host
after that host normalizes its transport request into `HttpIngressRequest`.

SNS `Notification`, `SubscriptionConfirmation`, and `UnsubscribeConfirmation`
deliveries become `aws.sns.notification`, `aws.sns.subscription-confirmation`,
and `aws.sns.unsubscribe-confirmation` events respectively. Subscription
confirmation is never performed automatically; `SubscribeURL` and `Token` are
preserved under `metadata.sns` so application code can decide whether to act on
them.

The SNS signature is verified before the delivery is mapped. The `sns-validator`
dependency is imported only from the SNS subpath, so consumers of future webhook
families do not load it.
