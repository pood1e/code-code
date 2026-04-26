## responsibility

- 为 `console-api` 进程初始化统一 OTel TracerProvider / MeterProvider。
- 让 HTTP、gRPC client、Prometheus query outbound HTTP 使用同一套 OTel context 与 exporter。
- 通过 OTLP HTTP 向 OTel Collector 导出 traces/metrics。

## key external fields and methods

- `telemetry.Setup(ctx, serviceName) (shutdown, error)`
- `OTEL_SERVICE_NAME`
- `OTEL_EXPORTER_OTLP_ENDPOINT`
- `OTEL_EXPORTER_OTLP_PROTOCOL`

## implementation notes

- `resource` 合并 env/process/host 与 `service.name`。
- traces: `otlptracehttp` + batch processor。
- metrics: `otlpmetrichttp` + periodic reader。
- inbound HTTP 使用 `otelhttp.NewHandler`，outbound gRPC 使用 `otelgrpc.NewClientHandler`。
