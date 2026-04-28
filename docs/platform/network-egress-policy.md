# Network Egress Policy

## responsibility

`platform-egress-service` owns the canonical external access model and compiles it to Istio Ambient resources.

The canonical contract is `egress.v1.EgressPolicy`:

- `ExternalAccessSet`: owner-submitted declaration, usually synced from YAML by the owning service.
- `ExternalRule`: external destination registration, including host, optional `address_cidr`, port, protocol, and DNS resolution.
- `ServiceRule`: source workload identities allowed to use one destination.
- `HttpEgressRoute`: opt-in L7 route for selected HTTP interfaces that need Gateway API header filters, TLS origination, or route-scoped dynamic header authz.

## external fields

- `ConfigMap/code-code-egress-policy` in the network egress namespace, key `egress-policy.json`: desired `EgressPolicy`.
- `ServiceEntry`: one generated external destination per normalized `destination_id`.
- `AuthorizationPolicy`: generated allow policies grouped by identical source service-account allowlists, using `targetRefs` to the generated `ServiceEntry` resources.
- `Gateway/egress-waypoint`: Ambient waypoint in the egress namespace.
- `Gateway/code-code-egress-gw-*`: generated only for explicit `HttpEgressRoute` destinations. Each L7 HTTPS destination gets its own Gateway API `Gateway` with an `HTTPS` listener on port `80` using Istio `ISTIO_MUTUAL` termination.
- `HTTPRoute`: only generated for explicit `HttpEgressRoute` entries. Egressservice generates the official two-hop egress shape: `ServiceEntry -> generated L7 gateway service` and `generated L7 gateway -> external Hostname`.
- `DestinationRule`: only generated for explicit HTTPS L7 routes. One rule secures workload-to-egress-gateway traffic with `ISTIO_MUTUAL`; another originates TLS from the egress gateway to the external host with `SIMPLE`.

## invariants

- Destination resources are destination-centric, not source-service-centric.
- Source authorization resources are source-allowlist-centric, so one `AuthorizationPolicy` may target many external destinations with the same allowed service accounts.
- `ServiceEntry` cardinality grows with normalized external destinations, not with source services or route rules. `AuthorizationPolicy` cardinality grows with distinct source service-account allowlists, not with every service/destination pair.
- L7 route resources are opt-in for selected HTTP interfaces only. Baseline L4/TLS access does not create `HTTPRoute` or `DestinationRule`.
- `preset-proxy` and any other corporate proxy endpoint are ordinary `ExternalRule` destinations: TCP port, optional `address_cidr`, and `resolution: NONE` when the endpoint is an IP.
- If a corporate proxy is used, Istio only authorizes the proxy destination. Final host authorization belongs to that proxy, not to egressservice.
- Source authorization is by service account in `namespace/name` form.
- `host_wildcard` is not accepted by the current Ambient waypoint egress path. Istio documents that ztunnel and waypoint proxies do not support wildcard hosts, so broad domain access must be modeled as exact approved hosts or routed through a corporate proxy destination.
- Runtime Pods do not receive `HTTP_PROXY`, `HTTPS_PROXY`, or `NO_PROXY`.
- Runtime and control-plane egress NetworkPolicies must allow the egress namespace on both application ports such as `443` and Ambient HBONE port `15008`.
- The egress namespace has its own default-deny egress policy. `platform-egress-service` is allowed to reach the Kubernetes API and OTel Collector. Because Ambient pod-to-pod traffic uses HBONE, egress to Ambient OTel Collector pods must allow port `15008` in addition to OTLP ports such as `4317` and `4318`. `egress-waypoint` and `code-code-egressgateway` are allowed to reach Istiod, ext_authz, OTel Collector, external TLS ports, and configured proxy ports.
- Kubernetes `NetworkPolicy` is only an L3/L4 guardrail. It does not replace `ServiceEntry`, `AuthorizationPolicy`, ext_authz, corporate proxy policy, or cloud/firewall egress controls for host-level decisions.
- TLS trust bundle distribution is separate from route and authorization policy.
- Header mutation and header collection are not `ExternalRule` or `ServiceRule` concerns.
- Static HTTP header mutation must use Gateway API `HTTPRoute` filters at the waypoint or egress gateway that actually handles HTTP.
- Header collection must use Istio `Telemetry` with access logs, tracing, OTel, or ALS providers at the same L7 proxy point.
- Dynamic header mutation, redaction, or per-source decisioning must use Istio `ext_authz` first.
- Wasm is not part of the current egress execution path. Istio documents waypoint `WasmPlugin` as an alpha extension mechanism, while Gateway API `HTTPRoute` filters, Istio `CUSTOM` authorization, and Istio `Telemetry` cover the current header mutation and collection requirements.
- Do not attach `CUSTOM ext_authz` globally to the shared egress waypoint while it also carries TLS passthrough destinations. Complex header replacement needs a dedicated HTTP/L7 route, waypoint, or egress gateway attachment point where HTTP attributes are available.
- Request or response body mutation is not a current platform feature and is not expressible with portable Gateway API `HTTPRoute` filters. If it becomes required, it must be a separate explicit L7 processing lane with bounded body size, content-type allowlists, redaction rules, and TLS termination/origination. Preferred landing points are an application/provider adapter or a gateway that officially supports Envoy external processing; do not implement body mutation through Ambient ztunnel, waypoint `EnvoyFilter`, or a speculative in-repo processor.
- `EGRESS_PROTOCOL_TLS` means L4/SNI passthrough for ordinary `https://...` clients. It does not create L7 routes.
- `EGRESS_PROTOCOL_HTTPS` means an explicit L7 HTTPS/TLS-origination lane. It registers both `80/HTTP` and the upstream `HTTPS` port on the generated `ServiceEntry`.
- TLS passthrough routes cannot mutate or collect HTTP headers. For external HTTPS APIs, header-level L7 behavior uses Istio's TLS origination pattern: the workload sends HTTP on port `80` inside the mesh, and the egress gateway originates TLS to the external host on port `443` or the configured HTTPS port.
- `HttpEgressRoute` is an explicit opt-in for that host/destination and should not be enabled on a default preset used by ordinary `https://...` clients. In live testing, a `HTTPRoute` attached to the external `ServiceEntry` can capture the host broadly enough to break normal HTTPS clients. Use it only when the caller is configured for HTTP-in-mesh/TLS-origination, or introduce a separate egress-facing host for the L7 lane.
- `HttpEgressRoute` may only reference an exact-host `EGRESS_PROTOCOL_HTTPS` destination.
- Wildcard destinations cannot be used by baseline egress or `HttpEgressRoute` in this implementation.

## implementation notes

- `platform-support-service` reads network-owned startup sets such as `vendors/support/external_rule_sets.yaml` and `vendors/support/proxy_presets.yaml` after startup and calls `ApplyExternalAccessSet`; this runs in a goroutine and does not block readiness.
- The support-owned `external_rule_sets.yaml` is a private YAML convenience for preset rule bundles. It is compiled into canonical `ExternalAccessSet` / `ExternalRule` / `ServiceRule` / `HttpEgressRoute` proto messages before crossing the egressservice gRPC boundary.
- `external_rule_sets.yaml` may contain `startupSync: false` smoke sets. These are parsed and tested, but support does not submit them during startup. They exist only for explicit L7 verification and must use a dedicated test service account.
- The support-owned `proxy_presets.yaml` may name proxy application protocols such as `http`, `http-connect`, `socks4`, and `socks5`. That field is private support configuration; egressservice receives only the compiled TCP `ExternalRule` for the proxy endpoint.
- `platform-egress-service` performs replacement, diff, persistence, resource apply, and stale resource cleanup.
- The platform Helm chart must not render `ConfigMap/code-code-egress-policy`; chart upgrades must not reset egressservice-owned runtime state. Support-owned startup access sets are synchronized through egressservice gRPC after support starts.
- `ApplyExternalAccessSet` replaces one named access set and rejects empty access sets. Deletion must use `DeleteExternalAccessSet`; an empty set is not a valid deletion marker.
- `deploy/scripts/egress-access-set-smoke.sh` is the repeatable live control-plane smoke for access-set lifecycle behavior. It port-forwards to `platform-egress-service`, applies the non-startup L7 smoke access set, deletes it through `DeleteExternalAccessSet`, and verifies startup baseline access sets remain present.
- `deploy/scripts/egress-data-plane-smoke.sh` is the repeatable live data-plane smoke. It can run focused checks through `PLATFORM_EGRESS_SMOKE_CHECKS`: `l4`, `proxy`, `l7-header`, `l7-telemetry`, and `dynamic-authz`. The default path verifies baseline L4 TLS reachability, preset proxy TCP reachability, and L7 request/response header modifier behavior, then deletes the access set during cleanup. The L4 check is intentionally TCP/TLS reachability only; HTTP body behavior belongs to the L7 smoke path.
- `make -C deploy smoke-egress-l7-telemetry` applies the non-startup L7 access set, waits for the egress-owned Istio `Telemetry` targetRefs, sends response headers that match the runtime telemetry profile, and checks the resulting Prometheus metrics. `make -C deploy smoke-egress-l7-dynamic-authz` applies the non-startup dynamic authz smoke set and verifies the generated Istio `CUSTOM` `AuthorizationPolicy` is attached to `ServiceEntry` targets with the configured ext_authz provider.
- Current managed L7 resources use explicit roles: `direct-http-route`, `forward-http-route`, and `tls-origination`. Removed pre-v1.5 experimental route shapes are not compatibility inputs.
- Istio's external HTTPS proxy task models the proxy itself as a TCP `ServiceEntry` with `addresses` and `resolution: NONE`; egressservice represents that using the same `ExternalRule` model, not a separate proxy model.
- Ambient L7 policy and Gateway API routes remain waypoint/gateway-owned. Baseline external access does not synthesize route resources; header behavior is represented by official Istio/Gateway API resources, not by egressservice-specific header views.
- Egressservice creates the dedicated L7 egress `Gateway` per HTTPS destination. The chart only provides NetworkPolicy egress allowances for generated gateway Pods by label. Egressservice attaches route-scoped `CUSTOM` `AuthorizationPolicy` to the L7 destination `ServiceEntry` only when at least one `HttpEgressRoute` sets `dynamic_header_authz`, so dynamic header decisions run at the egress waypoint before traffic is forwarded to the generated TLS-origination gateway.
- Passive telemetry belongs to `observability.v1.ObservabilityProfile` and is applied by `platform-egress-service`; egress policy does not carry telemetry profile references.
- Support submits the runtime HTTP telemetry profile set once through egressservice gRPC. `platform-egress-service` persists that canonical `ObservabilityCapability` in `ConfigMap/otel-collector-runtime-profiles`, then derives the OTel Collector runtime config, Istio `extensionProviders`, and Istio `Telemetry` targetRefs from it.
- `platform-egress-service` periodically reconciles Istio `Telemetry` targetRefs from current generated L7 egress Gateways and repairs the Collector runtime config from the stored profile set. The infra chart may bootstrap `ConfigMap/otel-collector-runtime-config` with `{}` so the collector can start, but dynamic runtime telemetry content is egressservice-owned.
- `platform-auth-service` implements the Envoy gRPC ext_authz check API as a thin adapter over auth-owned header rewrite policy. It derives runtime Pod source from Envoy source peer attributes, using the source IP as the locator and the SPIFFE source principal namespace as an optional narrowing hint. Egressservice does not receive credential material or concrete header rules.
- The old in-repo Wasm modules and the unused Envoy `ext_proc` header processor are not retained as compatibility paths. Future external processing for body mutation must be introduced as a new explicit L7 capability with a current owner and deployment path.
- Obsolete proxy, AutoProxy, `VirtualService`, and `DestinationRule` paths are not compatibility inputs.
- `GetEgressRuntimePolicy` remains a runtime metadata query for target host and path-prefix filtering; it is not the egress policy source of truth.

References:

- https://istio.io/latest/docs/tasks/traffic-management/egress/http-proxy/
- https://istio.io/latest/docs/tasks/traffic-management/egress/egress-gateway-tls-origination/
- https://istio.io/latest/docs/ambient/usage/l7-features/
- https://gateway-api.sigs.k8s.io/guides/http-header-modifier/
- https://istio.io/latest/docs/reference/config/telemetry/
- https://istio.io/latest/docs/tasks/security/authorization/authz-custom/
- https://istio.io/latest/docs/ambient/usage/extend-waypoint-wasm/
- https://gateway.envoyproxy.io/docs/tasks/extensibility/ext-proc/
