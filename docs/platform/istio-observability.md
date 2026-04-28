# Istio Observability

## Responsibility

Istio owns mesh traffic telemetry. `code-code-infra` stores and serves that telemetry through Prometheus, OTel Collector, Tempo, and optional Grafana.

## External Fields

- `ISTIO_OTEL_COLLECTOR_SERVICE`: OTLP gRPC collector service, default `otel-collector.code-code-observability.svc.cluster.local`.

## Implementation Notes

- Prometheus scrapes Istio and mesh data-plane pods through standard `prometheus.io` pod annotations.
- Istio `meshConfig.extensionProviders` exports traces to the OTel Collector over OTLP gRPC.
- Go control-plane services also export telemetry to the same OTel Collector over OTLP gRPC on `:4317`.
- Mesh-level `Telemetry/mesh-default` enables Istio standard Prometheus metrics.
- Trace export is configured through Istio `meshConfig.defaultProviders.tracing` and the `otel-tracing` extension provider.
- Tempo stores traces; Grafana reads Prometheus and Tempo as data sources.
