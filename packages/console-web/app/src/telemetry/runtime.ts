import {
  metrics,
  SpanStatusCode,
  trace,
  type Attributes,
  type Histogram,
  type Meter,
} from "@opentelemetry/api";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { DocumentLoadInstrumentation } from "@opentelemetry/instrumentation-document-load";
import { FetchInstrumentation } from "@opentelemetry/instrumentation-fetch";
import { XMLHttpRequestInstrumentation } from "@opentelemetry/instrumentation-xml-http-request";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { MeterProvider, PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { WebTracerProvider } from "@opentelemetry/sdk-trace-web";
import { ZoneContextManager } from "@opentelemetry/context-zone";
import { readConsoleWebTelemetryConfig } from "./config";
import { registerWebVitals, type WebVitalMeasurement } from "./web-vitals";
const telemetryTracerName = "console-web/app";
const telemetryMeterName = "console-web/app";
type Counter = ReturnType<Meter["createCounter"]>;
type ValueHistogram = Histogram;
type TelemetryState = {
  enabled: boolean;
  tracer: ReturnType<typeof trace.getTracer>;
  errorCounter: Counter;
  routeChangeCounter: Counter;
  webVitalHistograms: Record<WebVitalMeasurement["name"], ValueHistogram>;
};
const noopMeter = metrics.getMeter("console-web/noop");
let state: TelemetryState = {
  enabled: false,
  tracer: trace.getTracer("console-web/noop"),
  errorCounter: noopMeter.createCounter("console_web.noop.error_count"),
  routeChangeCounter: noopMeter.createCounter("console_web.noop.route_change_count"),
  webVitalHistograms: {
    cls: noopMeter.createHistogram("console_web.noop.web_vital.cls"),
    fcp: noopMeter.createHistogram("console_web.noop.web_vital.fcp"),
    inp: noopMeter.createHistogram("console_web.noop.web_vital.inp"),
    lcp: noopMeter.createHistogram("console_web.noop.web_vital.lcp"),
    ttfb: noopMeter.createHistogram("console_web.noop.web_vital.ttfb"),
  },
};
let initialized = false;
let lastRoutePath = "";

export function initializeConsoleWebTelemetry() {
  if (initialized) {
    return;
  }
  initialized = true;
  const config = readConsoleWebTelemetryConfig(import.meta.env);
  if (!config.enabled) {
    return;
  }
  const resourceAttributes: Attributes = { "service.name": config.serviceName };
  if (config.serviceVersion) {
    resourceAttributes["service.version"] = config.serviceVersion;
  }
  if (config.deploymentEnvironment) {
    resourceAttributes["deployment.environment.name"] = config.deploymentEnvironment;
  }
  const resource = resourceFromAttributes(resourceAttributes);
  if (config.tracesEndpoint) {
    const traceExporter = new OTLPTraceExporter({ url: config.tracesEndpoint });
    const traceProvider = new WebTracerProvider({
      resource,
      spanProcessors: [new BatchSpanProcessor(traceExporter)],
    });
    traceProvider.register({ contextManager: new ZoneContextManager() });
    registerInstrumentations({
      instrumentations: [
        new DocumentLoadInstrumentation(),
        new FetchInstrumentation({
          propagateTraceHeaderCorsUrls: config.propagateTraceHeaderCorsUrls,
        }),
        new XMLHttpRequestInstrumentation({
          propagateTraceHeaderCorsUrls: config.propagateTraceHeaderCorsUrls,
        }),
      ],
    });
  }
  if (config.metricsEndpoint) {
    const metricExporter = new OTLPMetricExporter({ url: config.metricsEndpoint });
    const metricReader = new PeriodicExportingMetricReader({
      exporter: metricExporter,
      exportIntervalMillis: config.metricExportIntervalMillis,
    });
    const meterProvider = new MeterProvider({
      resource,
      readers: [metricReader],
    });
    metrics.setGlobalMeterProvider(meterProvider);
  }
  const meter = metrics.getMeter(telemetryMeterName);
  state = {
    enabled: true,
    tracer: trace.getTracer(telemetryTracerName),
    errorCounter: meter.createCounter("app.frontend.error.count", {
      description: "Number of captured frontend errors.",
      unit: "{error}",
    }),
    routeChangeCounter: meter.createCounter("app.frontend.route.change.count", {
      description: "Number of route changes in console-web.",
      unit: "{navigation}",
    }),
    webVitalHistograms: {
      cls: meter.createHistogram("web.vitals.cls", { description: "Cumulative Layout Shift.", unit: "1" }),
      fcp: meter.createHistogram("web.vitals.fcp", { description: "First Contentful Paint.", unit: "ms" }),
      inp: meter.createHistogram("web.vitals.inp", { description: "Interaction to Next Paint.", unit: "ms" }),
      lcp: meter.createHistogram("web.vitals.lcp", { description: "Largest Contentful Paint.", unit: "ms" }),
      ttfb: meter.createHistogram("web.vitals.ttfb", { description: "Time to First Byte.", unit: "ms" }),
    },
  };
  bindGlobalErrorHandlers();
  registerWebVitals((measurement) => {
    state.webVitalHistograms[measurement.name].record(measurement.value, {
      "web.vital.rating": measurement.rating,
      "web.vital.navigation_type": measurement.navigationType,
      "url.path": currentRoutePath(),
    });
  });
}

export function recordConsoleWebRouteChange(path: string) {
  const normalizedPath = path.trim();
  if (!state.enabled || normalizedPath === "" || normalizedPath === lastRoutePath) {
    return;
  }
  lastRoutePath = normalizedPath;
  state.routeChangeCounter.add(1, { "url.path": normalizedPath });
  const span = state.tracer.startSpan("ui.route.change", {
    attributes: { "url.path": normalizedPath },
  });
  span.end();
}

export function recordConsoleWebError(source: string, error: unknown) {
  const normalizedSource = source.trim() || "unknown";
  const errorType = resolveErrorType(error);
  state.errorCounter.add(1, {
    "error.source": normalizedSource,
    "error.type": errorType,
  });
  const span = state.tracer.startSpan("ui.error", {
    attributes: {
      "error.source": normalizedSource,
      "error.type": errorType,
    },
  });
  span.setStatus({ code: SpanStatusCode.ERROR });
  if (error instanceof Error) {
    span.recordException(error);
  } else if (error != null) {
    span.recordException({ message: String(error), name: errorType });
  }
  span.end();
}

function bindGlobalErrorHandlers() {
  if (typeof window === "undefined") {
    return;
  }
  window.addEventListener("error", (event) => {
    recordConsoleWebError("window.error", event.error ?? event.message);
  });
  window.addEventListener("unhandledrejection", (event) => {
    recordConsoleWebError("window.unhandledrejection", event.reason);
  });
}

function currentRoutePath() {
  if (typeof window === "undefined") {
    return "";
  }
  const hashRoute = window.location.hash.startsWith("#/") ? window.location.hash.slice(1) : "";
  if (hashRoute) {
    return hashRoute;
  }
  return `${window.location.pathname}${window.location.search}`;
}

function resolveErrorType(error: unknown) {
  if (error instanceof Error && error.name.trim()) {
    return error.name.trim();
  }
  return typeof error;
}
