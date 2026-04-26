## responsibility

- 为 platform services 与 run-once workflow containers 初始化统一 OTel telemetry provider。
- 让 gRPC server/client 通过 OTel 标准链路出 span/metric。
- 统一把控制面 metrics/traces 以 OTLP 发送到 OTel Collector；Prometheus 只作为 OTLP metrics storage/query backend。

## key external fields and methods

- `telemetry.Setup(ctx, serviceName) (shutdown, error)`
- `OTEL_SERVICE_NAME`
- `OTEL_EXPORTER_OTLP_ENDPOINT`

## implementation notes

- service 侧 gRPC server/client 使用 `otelgrpc` stats handler。
- Go service telemetry mainline 统一通过 OTLP gRPC exporter 发送到 `otel-collector.code-code-observability.svc.cluster.local:4317`。
- `OTEL_EXPORTER_OTLP_ENDPOINT` 是唯一需要的 Go service OTLP endpoint 配置；signal-specific endpoint/protocol env 不属于当前主线。
- OTel Collector 不做 Prometheus scrape fan-in；metrics pipeline 是 `OTLP -> Collector -> Prometheus OTLP receiver`。
- 自研服务不暴露 `/metrics`，controller-runtime metrics server 默认关闭。
- run-once workflow container 仅做 provider 初始化和一次业务动作执行。
