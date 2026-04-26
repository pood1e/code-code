# Egress Gateway

## Responsibility

Istio Ambient owns transparent outbound capture for platform and runtime workloads.

## External Fields

- `ServiceEntry`: managed external host allowlist.
- `Gateway/code-code-egress`: Istio egress gateway server selection.
- `VirtualService`: mesh-to-egress-gateway and egress-gateway-to-external routing.
- `DestinationRule`: egress gateway subsets, upstream TLS origination, and HTTP CONNECT tunnel settings for proxy routes.
- `Certificate/code-code-egress-tls-termination`: TLS credential in the egress gateway namespace.
- `Bundle/code-code-egress-trust-bundle`: trust-manager bundle projected to platform and runtime namespaces.
- `Gateway/waypoint`: one Istio waypoint per enrolled namespace.
- `Deployment/code-code-egress-proxy-adapter`: official Envoy adapter for routes that require both TLS termination and an HTTP proxy.

## Implementation Notes

HTTPS egress is allowlist-based. The canonical user policy is `egress.v1.EgressPolicy`, stored by `platform-network-service` in `ConfigMap/code-code-egress-policy`. The console can edit custom exact-host and suffix-host rules, HTTP proxies, and one external ZeroOmega-compatible AutoProxy URL. Saving or reloading the external rule set immediately fetches the URL, parses supported host rules, and applies Istio networking resources.

The external rule set is intentionally singular: `external_rule_set.source_url`, `enabled`, `action`, and `proxy_id`. Multi-source rule-set YAML ConfigMaps are not part of the current model.

Default policy keeps external rule behavior aligned on `preset-proxy`: `external_rule_set` defaults to `action=proxy` with `proxy_id=preset-proxy` (while still `enabled=false`), and `raw.githubusercontent.com` is preseeded as a custom proxy rule so rule-set source fetch traffic can use the same proxy path.

Istio owns traffic capture through CNI, ztunnel, waypoint, and the egress gateway.

Route behavior is projected from the canonical policy and observed Istio resources. Platform labels on Istio resources carry only route identity, source grouping, and proxy identity.

Istio networking resource generation and projection use the official Istio Go API types.

Proxy adapter Kubernetes resources use the official Kubernetes Go API types.

Proxy adapter Envoy bootstrap config uses the official Envoy go-control-plane protobuf types.

Routes marked `tls_termination=true` terminate TLS at the Istio egress gateway. cert-manager issues the gateway credential, the Secret lives in the egress gateway workload namespace, and trust-manager distributes the egress CA to workload namespaces before the egress gateway originates TLS to the external upstream.

`action=proxy` with TLS passthrough uses Istio's documented HTTP CONNECT tunnel settings on the egress gateway TCP route. `action=proxy` with TLS termination cannot be represented correctly with only Istio `DestinationRule.tunnel` plus upstream TLS because Istio applies TLS to the HTTP proxy connection, and Istio `proxyv2` does not ship Envoy's HTTP/1.1 proxy upstream transport socket. For this case, `platform-network-service` routes gateway HTTP traffic to `code-code-egress-proxy-adapter`, an official Envoy deployment configured with `envoy.transport_sockets.http_11_proxy`.

HTTP protocol selection is explicit on each egress rule. `http_protocol_mode=http2-preferred` configures supported upstream hops for HTTP/2 with HTTP/1.1 fallback. `http_protocol_mode=http2-required` configures the adapter-to-provider hop as HTTP/2-only and advertises only `h2` with TLS ALPN. The HTTP proxy control connection remains HTTP/1.1 CONNECT; HTTP/2 is negotiated inside the CONNECT tunnel between the adapter and provider.

WebSocket support is explicit per route with `allow_websocket_upgrade=true`. It requires `tls_termination=true` because header injection runs on the decrypted HTTP Upgrade handshake at the egress gateway. Passthrough TLS cannot inject headers. WebSocket routes force HTTP/1.1 on the effective upstream hops and, for proxy routes, enable Envoy `upgrade_configs` in `code-code-egress-proxy-adapter`.

Proxy hostnames stay as hostnames in managed Istio or Envoy data plane config. `platform-network-service` does not resolve and persist proxy IP addresses.

Istio workload certificates only secure mesh mTLS. They are not external-domain server certificates for TLS termination.

NetworkPolicy remains a coarse fail-closed guardrail; L7 egress policy is represented by Istio resources.
