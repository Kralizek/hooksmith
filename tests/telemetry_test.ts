import { assert, assertEquals } from "@std/assert";
import {
  context,
  metrics,
  trace,
} from "npm:@opentelemetry/api@^1.9.0";
import { AsyncLocalStorageContextManager } from "npm:@opentelemetry/context-async-hooks@^2.1.0";
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from "npm:@opentelemetry/sdk-trace-base@^2.1.0";
import {
  InMemoryMetricExporter,
  MeterProvider,
  PeriodicExportingMetricReader,
} from "npm:@opentelemetry/sdk-metrics@^2.1.0";
import type { Config, Event, Listener } from "@hooksmith/core";
import { pipe, project } from "@hooksmith/pipeline";
import { createLoggerFactory, createRuntime } from "@hooksmith/runtime";

Deno.test("OpenTelemetry composes consumer, Hooksmith, pipeline, and extension telemetry", async () => {
  const spanExporter = new InMemorySpanExporter();
  const tracerProvider = new BasicTracerProvider({
    spanProcessors: [new SimpleSpanProcessor(spanExporter)],
  });
  const contextManager = new AsyncLocalStorageContextManager().enable();
  trace.setGlobalTracerProvider(tracerProvider);
  context.setGlobalContextManager(contextManager);

  const metricExporter = new InMemoryMetricExporter();
  const metricReader = new PeriodicExportingMetricReader({
    exporter: metricExporter,
    exportIntervalMillis: 60_000,
  });
  const meterProvider = new MeterProvider({ readers: [metricReader] });
  metrics.setGlobalMeterProvider(meterProvider);

  try {
    const extensionTracer = trace.getTracer("example-extension");
    const terminal: Listener<Event<number>> = {
      name: "extension-listener",
      run(event) {
        return extensionTracer.startActiveSpan("extension.work", (span) => {
          try {
            return { success: true, data: event.data };
          } finally {
            span.end();
          }
        });
      },
    };

    const pipeline = pipe(
      { name: "length" },
      project((value: string) => value.length, "string-length"),
      terminal,
    );

    const config: Config<Event<string>> = {
      routes: [{
        name: "messages",
        listeners: [pipeline],
      }],
    };
    const runtime = createRuntime(config, {
      logger: createLoggerFactory({
        minimumLevel: "none",
        write() {},
      }),
    });
    const event: Event<string> = {
      type: "message.ready",
      timestamp: Temporal.Instant.from("2026-09-05T09:00:00Z"),
      source: { kind: "test", id: "source" },
      data: "hooksmith",
    };

    const consumerTracer = trace.getTracer("consumer");
    await consumerTracer.startActiveSpan("consumer.operation", async (span) => {
      try {
        const report = await runtime.process(event);
        assertEquals(report.success, true);
      } finally {
        span.end();
      }
    });

    const spans = spanExporter.getFinishedSpans();
    const byName = new Map(spans.map((span) => [span.name, span]));
    const consumer = byName.get("consumer.operation");
    const eventSpan = byName.get("hooksmith.event.process");
    const listenerSpan = byName.get("hooksmith.listener");
    const pipelineSpan = byName.get("hooksmith.pipeline");
    const extensionSpan = byName.get("extension.work");

    assert(consumer);
    assert(eventSpan);
    assert(listenerSpan);
    assert(pipelineSpan);
    assert(extensionSpan);

    assertEquals(eventSpan.parentSpanContext?.spanId, consumer.spanContext().spanId);
    assertEquals(listenerSpan.parentSpanContext?.spanId, eventSpan.spanContext().spanId);
    assertEquals(pipelineSpan.parentSpanContext?.spanId, listenerSpan.spanContext().spanId);
    assertEquals(extensionSpan.parentSpanContext?.spanId, pipelineSpan.spanContext().spanId);

    await metricReader.forceFlush();
    const metricNames = metricExporter.getMetrics()
      .flatMap((resource) => resource.scopeMetrics)
      .flatMap((scope) => scope.metrics)
      .map((metric) => metric.descriptor.name);

    assert(metricNames.includes("hooksmith.event.processed"));
    assert(metricNames.includes("hooksmith.event.duration"));
    assert(metricNames.includes("hooksmith.listener.invocation"));
    assert(metricNames.includes("hooksmith.listener.duration"));
    assert(metricNames.includes("hooksmith.pipeline.duration"));
  } finally {
    await tracerProvider.shutdown();
    await meterProvider.shutdown();
    context.disable();
    trace.disable();
    metrics.disable();
  }
});
