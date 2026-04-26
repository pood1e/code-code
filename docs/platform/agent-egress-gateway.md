# Agent Egress Gateway

## Responsibility

Istio Ambient owns transparent platform and runtime egress capture.

`code-code-egressgateway` is the shared Istio egress gateway for outbound HTTPS traffic.

## External Fields

- `ISTIO_VERSION`: pinned Istio chart version, default `1.29.2`.
- `ISTIO_NAMESPACE`: Istio control namespace, default `istio-system`.
- `ISTIO_EGRESS_GATEWAY_NAMESPACE`: egress gateway namespace, default `code-code-net`.
- `ISTIO_EGRESS_GATEWAY_RELEASE`: egress gateway Helm release, default `code-code-egressgateway`.
- `GATEWAY_API_VERSION`: Kubernetes Gateway API CRD version, default `v1.4.0`.
- `WASM_IMAGE_REGISTRY`: registry prefix used in `WasmPlugin` OCI URLs.
- `WASM_IMAGE_PUSH_REGISTRY`: registry prefix used by local build/push for Wasm OCI images.
- `WASM_INSECURE_REGISTRIES`: optional registry host list passed to the egress gateway `istio-proxy`.

## Implementation Notes

- Istio Ambient installs `istiod`, `istio-cni`, and `ztunnel` from official Istio Helm charts.
- `code-code` and `code-code-runs` are enrolled with `istio.io/dataplane-mode=ambient`.
- Each enrolled namespace owns one Istio waypoint `Gateway/waypoint`.
- `platform-network-service` writes Istio `ServiceEntry`, `Gateway`, and `VirtualService` resources as the durable egress policy truth.
- The egress gateway is a ClusterIP Istio gateway in `code-code-net`.
- Egress auth plugins are Istio `WasmPlugin` resources. Their OCI URLs must point at a registry reachable from the gateway pod; otherwise Istio fail-close installs a default-deny RBAC placeholder and external requests return `RBAC: access denied`.
- Istio telemetry is exported through Prometheus scrape annotations and OTLP tracing.
- Workloads do not receive proxy env vars, per-Pod sidecars, or platform-owned iptables init containers.
