const defaultServiceName = "console-web";
const defaultMetricExportIntervalMillis = 10_000;

export type ConsoleWebTelemetryConfig = {
  enabled: boolean;
  serviceName: string;
  serviceVersion: string;
  deploymentEnvironment: string;
  tracesEndpoint: string;
  metricsEndpoint: string;
  metricExportIntervalMillis: number;
  propagateTraceHeaderCorsUrls: Array<string | RegExp>;
};

export function readConsoleWebTelemetryConfig(env: ImportMetaEnv): ConsoleWebTelemetryConfig {
  const tracesEndpoint = resolveSignalEndpoint(
    env.VITE_OTEL_EXPORTER_OTLP_TRACES_ENDPOINT,
    env.VITE_OTEL_EXPORTER_OTLP_ENDPOINT,
    "/v1/traces",
  );
  const metricsEndpoint = resolveSignalEndpoint(
    env.VITE_OTEL_EXPORTER_OTLP_METRICS_ENDPOINT,
    env.VITE_OTEL_EXPORTER_OTLP_ENDPOINT,
    "/v1/metrics",
  );
  const hasExporterEndpoint = tracesEndpoint !== "" || metricsEndpoint !== "";

  return {
    enabled: parseBoolean(env.VITE_OTEL_ENABLED, hasExporterEndpoint) && hasExporterEndpoint,
    serviceName: normalizeString(env.VITE_OTEL_SERVICE_NAME) || defaultServiceName,
    serviceVersion: normalizeString(env.VITE_OTEL_SERVICE_VERSION),
    deploymentEnvironment: normalizeString(env.VITE_OTEL_DEPLOYMENT_ENVIRONMENT),
    tracesEndpoint,
    metricsEndpoint,
    metricExportIntervalMillis: parsePositiveInt(
      env.VITE_OTEL_METRIC_EXPORT_INTERVAL_MS,
      defaultMetricExportIntervalMillis,
    ),
    propagateTraceHeaderCorsUrls: parseTraceCorsUrls(env.VITE_OTEL_PROPAGATE_TRACE_CORS_URLS),
  };
}

function resolveSignalEndpoint(signalEndpoint: string | undefined, baseEndpoint: string | undefined, signalPath: string) {
  const normalizedSignalEndpoint = normalizeString(signalEndpoint);
  if (normalizedSignalEndpoint) {
    return normalizedSignalEndpoint;
  }
  const normalizedBaseEndpoint = normalizeString(baseEndpoint);
  if (!normalizedBaseEndpoint) {
    return "";
  }
  const baseWithoutSlash = normalizedBaseEndpoint.replace(/\/+$/, "");
  return `${baseWithoutSlash}${signalPath}`;
}

function parseTraceCorsUrls(raw: string | undefined) {
  const urls: Array<string | RegExp> = [];
  if (typeof window !== "undefined" && window.location.origin) {
    urls.push(window.location.origin);
  }
  for (const token of splitCsv(raw)) {
    const parsed = parseTraceCorsUrlToken(token);
    if (!parsed) {
      continue;
    }
    urls.push(parsed);
  }
  return urls;
}

function parseTraceCorsUrlToken(token: string): string | RegExp | null {
  const normalized = normalizeString(token);
  if (!normalized) {
    return null;
  }
  if (normalized.startsWith("/") && normalized.endsWith("/") && normalized.length > 2) {
    try {
      return new RegExp(normalized.slice(1, -1));
    } catch {
      return null;
    }
  }
  if (!normalized.includes("*")) {
    return normalized;
  }
  return new RegExp(`^${escapeRegExp(normalized).replace(/\\\*/g, ".*")}$`);
}

function splitCsv(raw: string | undefined) {
  return (raw || "")
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function normalizeString(value: string | undefined) {
  return (value || "").trim();
}

function parseBoolean(value: string | undefined, fallback: boolean) {
  const normalized = normalizeString(value).toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes") {
    return true;
  }
  if (normalized === "false" || normalized === "0" || normalized === "no") {
    return false;
  }
  return fallback;
}

function parsePositiveInt(value: string | undefined, fallback: number) {
  const normalized = normalizeString(value);
  if (!normalized) {
    return fallback;
  }
  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
