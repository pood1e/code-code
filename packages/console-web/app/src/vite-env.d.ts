/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_OTEL_ENABLED?: string;
  readonly VITE_OTEL_SERVICE_NAME?: string;
  readonly VITE_OTEL_SERVICE_VERSION?: string;
  readonly VITE_OTEL_DEPLOYMENT_ENVIRONMENT?: string;
  readonly VITE_OTEL_EXPORTER_OTLP_ENDPOINT?: string;
  readonly VITE_OTEL_EXPORTER_OTLP_TRACES_ENDPOINT?: string;
  readonly VITE_OTEL_EXPORTER_OTLP_METRICS_ENDPOINT?: string;
  readonly VITE_OTEL_METRIC_EXPORT_INTERVAL_MS?: string;
  readonly VITE_OTEL_PROPAGATE_TRACE_CORS_URLS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
