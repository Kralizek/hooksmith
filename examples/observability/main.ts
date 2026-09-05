import { type Counter, metrics, trace } from "@opentelemetry/api";
import type { Config, Event, Listener } from "@hooksmith/core";
import { pipe, project } from "@hooksmith/pipeline";
import { createRuntime, nullLoggerFactory } from "@hooksmith/runtime";

interface MessageData {
  text: string;
}

interface PreparedMessage {
  text: string;
  length: number;
}

const tracer = trace.getTracer("example-extension");
let messagesHandled: Counter | undefined;

const publish: Listener<Event<PreparedMessage>> = {
  name: "example-publisher",
  run(event) {
    return tracer.startActiveSpan("example.publish", (span) => {
      try {
        span.setAttribute("example.message.length", event.data.length);
        recordMessageHandled();
        return {
          success: true,
          message: `Published ${event.data.text}`,
        };
      } finally {
        span.end();
      }
    });
  },
};

const config = {
  routes: [{
    name: "messages",
    listeners: [
      pipe(
        { name: "prepare-message" },
        project<MessageData, PreparedMessage>(
          (message) => ({
            text: message.text.toUpperCase(),
            length: message.text.length,
          }),
          "prepare",
        ),
        publish,
      ),
    ],
  }],
} satisfies Config<Event<MessageData>>;

const runtime = createRuntime(config, { logger: nullLoggerFactory });

await runtime.process({
  type: "message.ready",
  timestamp: Temporal.Now.instant(),
  source: { kind: "example", id: "observability" },
  data: { text: "hello from Hooksmith" },
});

function recordMessageHandled(): void {
  const counter = messagesHandled ??= metrics
    .getMeter("example-extension")
    .createCounter("example.messages.handled", { unit: "{message}" });
  counter.add(1);
}
