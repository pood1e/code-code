# istio-platform

![Version: 0.1.0](https://img.shields.io/badge/Version-0.1.0-informational?style=flat-square) ![Type: application](https://img.shields.io/badge/Type-application-informational?style=flat-square) ![AppVersion: 1.29.2](https://img.shields.io/badge/AppVersion-1.29.2-informational?style=flat-square)

Helm chart for code-code Istio ambient custom resources

**Homepage:** <https://github.com/pood1e/code-code>

## Maintainers

| Name | Email | Url |
| ---- | ------ | --- |
| code-code platform team |  |  |

## Source Code

* <https://github.com/pood1e/code-code>

## Requirements

Kubernetes: `>=1.31.0-0 <1.36.0-0`

## Install

Install from the repository root:

```bash
helm upgrade --install code-code-istio-platform deploy/charts/istio-platform \
  --namespace <namespace> \
  --create-namespace \
  -f deploy/charts/istio-platform/examples/<env>.yaml
```

## Example Values

Review environment-specific overrides under `examples/` before installing.

## Values

Documented user-facing overrides. Regenerate this file with:

```bash
make -C deploy docs
```

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| components.ingressGateway | object | `{"allowedRouteNamespaceSelector":{"matchLabels":{"ingress.platform.code-code.internal/platform-ingress":"enabled"}},"backendEgress":[{"namespace":"code-code-console","podSelector":{"matchLabels":{"gateway.networking.k8s.io/gateway-name":"waypoint"}},"ports":[15008]},{"namespace":"code-code-console","podSelector":{"matchExpressions":[{"key":"app.kubernetes.io/name","operator":"In","values":["console-api","console-web"]}]},"ports":[15008,8080]},{"namespace":"code-code-showcase","podSelector":{"matchLabels":{"gateway.networking.k8s.io/gateway-name":"waypoint"}},"ports":[15008]},{"namespace":"code-code-showcase","podSelector":{"matchExpressions":[{"key":"app.kubernetes.io/name","operator":"In","values":["showcase-api","showcase-web"]}]},"ports":[15008,8080]},{"namespace":"code-code-observability","podSelector":{"matchLabels":{"gateway.networking.k8s.io/gateway-name":"waypoint"}},"ports":[15008]},{"namespace":"code-code-observability","podSelector":{"matchExpressions":[{"key":"app.kubernetes.io/name","operator":"In","values":["grafana","kiali"]}]},"ports":[15008,3000,20001]}],"enabled":true,"httpNodePort":30599,"httpPort":80,"name":"platform-ingress","serviceType":"NodePort"}` | components.ingressGateway controls the shared Istio Gateway API ingress gateway. |
| components.egressCertificates | object | `{"enabled":true}` | components.egressCertificates controls ClusterIssuers, root CA, and trust bundle projection. |
| components.waypoints | object | `{"enabled":true}` | components.waypoints controls the shared ambient waypoints. |
| components.telemetry | object | `{"enabled":true,"tracing":{"enabled":true,"provider":"otel-tracing","randomSamplingPercentage":10}}` | components.telemetry controls the mesh-default telemetry resource. |
| components.telemetry.tracing | object | `{"enabled":true,"provider":"otel-tracing","randomSamplingPercentage":10}` | components.telemetry.tracing enables Istio waypoint trace export through the mesh tracing provider. |
| components.telemetry.tracing.provider | string | `"otel-tracing"` | components.telemetry.tracing.provider is the Istio MeshConfig extension provider name. |
| components.telemetry.tracing.randomSamplingPercentage | int | `10` | components.telemetry.tracing.randomSamplingPercentage is the percentage of requests selected for mesh tracing. Istio Ambient docs recommend 1-10% for production; use 100 only for temporary debugging. |
| components.controlPlaneEgress | object | `{"enabled":true}` | components.controlPlaneEgress controls control-plane NetworkPolicy resources. |
| components.networkNamespaceEgress | object | `{"enabled":true,"externalPorts":[80,443],"kubernetesApiCidrs":["10.0.0.0/8","172.16.0.0/12","192.168.0.0/16"],"proxyPorts":[10809]}` | components.networkNamespaceEgress controls NetworkPolicy resources in the egress namespace. Kubernetes NetworkPolicy is L3/L4 only. Host/service-account authorization remains in ServiceEntry, AuthorizationPolicy, ext_authz, and infrastructure firewall policy. |
