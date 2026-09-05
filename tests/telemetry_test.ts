import { assert, assertEquals } from "@std/assert";
import { context, metrics, trace } from "@opentelemetry/api";
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import {
  AggregationTemporality,
  InMemoryMetricExporter,
  MeterProvider,
  PeriodicExportingMetricReader,
} from "@opentelemetry/sdk-metrics";
import type { Config, Event, Listener } from "@hooksmith/core";
import { pipe, project } from "@hooksmith/pipeline";
import { enableOpenTelemetry as enablePipelineOpenTelemetry } from "@hooksmith/pipeline/opentelemetry";
import { createRuntime, nullLoggerFactory } from "@hooksmith/runtime";
import { enableOpenTelemetry as enableRuntimeOpenTelemetry } from "@hooksmith/runtime/opentelemetry";

Deno.test("OpenTelemetry composes consumer, Hooksmith, pipeline, and extension telemetry", async () => {
  const spanExporter = new InMemorySpanExporter();
  const tracerProvider = new BasicTracerProvider({
    spanProcessors: [new SimpleSpanProcessor(spanExporter)],
  });
  const contextManager = new AsyncLocalStorageContextManager().enable();
  trace.setGlobalTracerProvider(tracerProvider);
  context.setGlobalContextManager(contextManager);

  const metricExporter = new InMemoryMetricExporter(
    AggregationTemporality.CUMULATIVE,
  );
  const metricReader = new PeriodicExportingMetricReader({
    exporter: metricExporter,
    exportIntervalMillis: 60_000,
  });
  const meterProvider = new MeterProvider({ readers: [metricReader] });
  metrics.setGlobalMeterProvider(meterProvider);

  const restoreRuntimeTelemetry = enableRuntimeOpenTelemetry({
    trace,
    metrics,
  });
  const restorePipelineTelemetry = enablePipelineOpenTelemetry({
    trace,
    metrics,
  });

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
    const runtime = createRuntime(config, { logger: nullLoggerFactory });
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

    assertEquals(
      eventSpan.parentSpanContext?.spanId,
      consumer.spanContext().spanId,
    );
    assertEquals(
      listenerSpan.parentSpanContext?.spanId,
      eventSpan.spanContext().spanId,
    );
    assertEquals(
      pipelineSpan.parentSpanContext?.spanId,
      listenerSpan.spanContext().spanId,
    );
    assertEquals(
      extensionSpan.parentSpanContext?.spanId,
      pipelineSpan.spanContext().spanId,
    );

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
    restorePipelineTelemetry();
    restoreRuntimeTelemetry();
    await tracerProvider.shutdown();
    await meterProvider.shutdown();
    contextManager.disable();
    context.disable();
    trace.disable();
    metrics.disable();
  }
});
