# Amazon SNS webhooks

Use `fromSnsHttp` to verify and map Amazon SNS HTTP/HTTPS deliveries into Hooksmith event documents.

```ts
import { fromSnsHttp } from "@hooksmith/webhooks/sns";
```

The mapper consumes Hooksmith's shared HTTP ingress context, verifies the SNS signature, preserves SNS transport metadata under `metadata.sns`, and maps the message payload to `event.data`.
