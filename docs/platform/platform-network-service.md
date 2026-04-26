# Platform Network Service

## responsibility

`platform-network-service` adapts Istio egress resources to the console policy API.

## external methods

- `platform.egress.v1.EgressService/ListEgressPolicies`
- `platform.egress.v1.EgressService/UpdateEgressPolicy`

## implementation notes

- Istio `ServiceEntry`, `Gateway`, `VirtualService`, and `DestinationRule` resources are the durable egress policy source.
- `ListEgressPolicies` lists managed Istio resources and projects rulesets, custom rules, proxies, and sync status.
- `UpdateEgressPolicy` validates direct/proxy host policy input (`host_exact` and `host_suffix`) and writes Istio resources with Server-Side Apply.
- Gateway and TLS termination `Certificate` resources are written to `PLATFORM_NETWORK_SERVICE_EGRESS_GATEWAY_NAMESPACE`; route resources stay in `PLATFORM_NETWORK_SERVICE_NAMESPACE`.
- `proxy + tls_termination` writes the official Envoy `code-code-egress-proxy-adapter` resources in the egress gateway namespace and routes terminated gateway HTTP traffic through that adapter.
- `http_protocol_mode` is projected through managed route annotations and materialized as Istio HTTP connection-pool settings or Envoy upstream protocol options, so HTTP/2 support is explicit on every terminating hop.
- `allow_websocket_upgrade` is projected through managed route annotations. It requires TLS termination for header injection and forces the effective protocol to HTTP/1.1 on the WebSocket route.
- `console-api` reads egress policy views through gRPC instead of importing egress domain code.
- Network egress implementation lives under `packages/platform-k8s/networkservice`.
