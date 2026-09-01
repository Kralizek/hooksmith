# External extensions

This example combines provider-specific Hooksmith extensions from separate JSR
packages in one route. A published page is announced to Bluesky and Slack.

The example keeps its external dependencies in this directory's `deno.json`
instead of adding them to the Hooksmith repository root. `@hooksmith/http` is
not imported here: Bluesky and Slack use it internally, but consumers only need
to import packages whose APIs they call directly.

Set the provider credentials and destination:

```sh
BLUESKY_IDENTIFIER=example.com
BLUESKY_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
SLACK_BOT_TOKEN=xoxb-...
SLACK_CHANNEL=C0123456789
```

From this directory, run the local Hooksmith CLI against the sample event:

```sh
deno run -A ../../packages/cli/mod.ts run event.yaml --config hooksmith.config.ts
```

Running from this directory lets Deno discover the local `deno.json`. If you
invoke Deno from elsewhere, use Deno's own `--config` flag to point to this
`deno.json`; that is separate from Hooksmith's `--config hooksmith.config.ts`
argument shown above.
