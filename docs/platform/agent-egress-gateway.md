# Agent Egress Gateway

## Responsibility

Istio Ambient owns transparent platform and runtime egress capture.

`code-code-egressgateway` is the shared Istio egress gateway for outbound HTTPS traffic.

## External Fields

- `ISTIO_VERSION`: pinned Istio chart version, default `1.29.2`.
- `ISTIO_NAMESPACE`: Istio control namespace, default `istio-system`.
- `ISTIO_EGRESS_GATEWAY_NAMESPACE`: egress gateway namespace, default `code-code-net`.
- `ISTIO_EGRESS_GATEWAY_RELEASE`: egress gateway Helm release, default `code-code-egressgateway`.
- `GATEWAY_API_VERSION`: Kubernetes Gateway API CRD version, default `v1.4.0` Experimental channel.
- `WASM_INSECURE_REGISTRIES`: optional registry host list passed to the egress gateway `istio-proxy`.
- `deploy/values/istiod.yaml`: official `istio/istiod` Helm values. It owns `meshConfig.extensionProviders`, including the egress auth provider classes `code-code-egress-auth-bearer`, `code-code-egress-auth-api-key`, and `code-code-egress-auth-session`.

## Implementation Notes

- Istio Ambient installs `base`, `istiod`, `istio-cni`, and `ztunnel` from official Istio Helm charts at `1.29.2`.
- `code-code` and `code-code-runs` are enrolled with `istio.io/dataplane-mode=ambient`.
- Each enrolled namespace owns one Istio waypoint `Gateway/waypoint`; the egress namespace owns `Gateway/egress-waypoint`.
- `platform-egress-service` writes `ServiceEntry` resources and grouped `AuthorizationPolicy targetRefs` from the canonical external access policy.
- The egress gateway is a ClusterIP Istio gateway in `code-code-net`.
- `platform-egress-service` creates dedicated ClusterIP Gateway API `Gateway/code-code-egress-gw-*` resources for selected HTTPS L7 egress destinations. They are separate from the shared `egress-waypoint` that carries default L4/TLS passthrough access.
- New L7 header policy uses official Gateway API `HTTPRoute` filters for static mutation, Istio `Telemetry` for header collection, and Istio external authorization for dynamic header decisions.
- `platform-egress-service` only creates L7 route resources for explicit `egress.v1.HttpEgressRoute` entries that target `EGRESS_PROTOCOL_HTTPS` destinations: one route from the `ServiceEntry` to the generated L7 gateway service and one route from the L7 gateway to the external `Hostname`. HTTPS L7 routes also get a `DestinationRule` for mesh mTLS to the gateway and a `DestinationRule` for TLS origination to the external host.
- Egress auth MeshConfig providers are selected by auth policy class for dedicated HTTP/L7 attachment points. The chart does not attach a global `CUSTOM` `AuthorizationPolicy` to `Gateway/egress-waypoint`, because that shared waypoint also carries TLS passthrough destinations.
- Istio does not support `from.source.namespaces` matching with `CUSTOM`; source-specific checks must be done by `platform-auth-service` from Envoy Check attributes and runtime metadata when a dedicated L7 policy is introduced.
- The legacy Proxy-Wasm egress auth path has been removed from the deployment path. Dynamic HTTP header policy uses Istio external authorization; passive header collection uses Istio Telemetry and OTel Collector.
- Istio telemetry is exported through Prometheus scrape annotations and OTLP tracing.
- Workloads do not receive proxy env vars, per-Pod sidecars, or platform-owned iptables init containers.
