# Network Egress Policy

## responsibility

Network egress policy owns endpoint route selection for outbound hosts.
It does not know whether one policy id came from a vendor, CLI, surface, or
custom API resource.

## external fields

- `ServiceEntry`: exact external host and proxy endpoint declarations, with DNS or STATIC resolution matching the endpoint address.
- `Gateway/code-code-egress`: shared Istio egress gateway config.
- `VirtualService`: endpoint routing through the Istio egress gateway.
- `DestinationRule`: egress gateway subsets, upstream TLS origination, and HTTP CONNECT tunnel settings for proxy routes.
- `Certificate/code-code-egress-tls-termination`: gateway credential for TLS termination hosts.
- `Deployment/code-code-egress-proxy-adapter`: official Envoy adapter for `action=proxy` plus `tls_termination=true`.

## implementation notes

- Istio networking resources are the durable truth.
- `platform-network-service` lists managed Istio resources and projects them into `EgressPolicyView`.
- `platform-network-service` updates policy by Server-Side Apply of Istio resources.
- The mapper uses official Istio Go API types for Istio networking resource generation and projection.
- Proxy adapter Kubernetes resources use official Kubernetes Go API types.
- Proxy adapter Envoy bootstrap config uses official Envoy go-control-plane protobuf types.
- Endpoint route action and TLS termination are projected from `VirtualService` routing spec. Platform labels only carry identity and grouping metadata.
- User custom rules support exact host and suffix host matching. Suffix matching
  follows common precedence: exact host overrides suffix rules, and longer suffix
  rules override shorter suffix rules.
- External AutoProxy rule set hosts are **not** expanded into per-host Istio resources. The loader records load status and host counts in `code-code-egress-policy` (`external-rule-set-status.json`) for UI visibility, while bulk matching stays on the proxy-side rule set path.
- Custom rules remain the Istio-managed allowlist path and are bounded (`maxManagedCustomTargets=512`) to avoid generating oversized Istio object sets.
- Default egress policy seeds `raw.githubusercontent.com` as a proxy custom rule and keeps `external_rule_set` aligned to `action=proxy` with `proxy_id=preset-proxy` (disabled by default until explicitly enabled).
- `tls_termination=true` uses Istio egress gateway TLS termination and upstream TLS origination for that host.
- `http_protocol_mode` is explicit per rule or rule set. `http1` disables upstream HTTP/2, `http2-preferred` enables HTTP/2 with HTTP/1.1 fallback where the data plane supports ALPN, and `http2-required` configures the upstream hop as HTTP/2-only.
- `allow_websocket_upgrade=true` is only valid with `tls_termination=true`. Header injection is applied to the HTTP Upgrade handshake after gateway TLS termination; passthrough TLS cannot expose or mutate request headers.
- WebSocket routes force the effective upstream protocol to HTTP/1.1 even if `http_protocol_mode` was requested as HTTP/2. Classic WebSocket uses the HTTP/1.1 Upgrade path, and the adapter must preserve that handshake before tunneling data.
- `action=proxy` with `tls_termination=false` uses Istio CONNECT tunneling from the egress gateway to the configured HTTP proxy.
- `action=proxy` with `tls_termination=true` routes terminated gateway HTTP traffic to `code-code-egress-proxy-adapter`; that official Envoy instance uses HTTP CONNECT to the configured proxy and then originates TLS to the endpoint host.
- HTTP/2 is configured hop by hop. Direct TLS termination uses Istio `DestinationRule.connectionPool.http.h2UpgradePolicy`. Proxy TLS termination uses an adapter `DestinationRule` for gateway-to-adapter HTTP/2 and Envoy `HttpProtocolOptions` plus TLS ALPN for adapter-to-upstream HTTP/2 through the HTTP/1.1 CONNECT control tunnel.
- For WebSocket proxy routes, `code-code-egress-proxy-adapter` enables Envoy `upgrade_configs`, disables the ordinary route timeout, extends stream idle timeout, and forces HTTP/1.1 on both the gateway-to-adapter and adapter-to-upstream hops.
- Proxy host DNS resolution stays in Istio or Envoy data plane resources; `platform-network-service` does not persist resolved proxy IPs.
- TLS termination certificates are issued by cert-manager; trust-manager distributes a bundle containing default CAs plus the egress CA to enrolled workload namespaces.
- Runtime Pods do not receive proxy env vars.
- Runtime selectors are resolved through `GetEgressRuntimePolicy(policy_id,
  runtime_url)`.
- `runtime_policies.yaml` is the network-service-owned declaration for target
  hosts and path prefixes used by AgentRun header replacement and header metric
  filtering.
- `platform-support-service` may bind a provider to an `egress_policy_id`, but
  it does not expose the concrete network rule body.
