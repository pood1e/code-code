# istio-platform

`istio-platform` owns the platform-managed Istio custom resources that sit on top of the upstream Ambient installation.

It currently renders:

- egress certificates and trust bundle projection
- ambient waypoints
- telemetry configuration (disabled by default)
- control-plane egress network policy
- egress gateway WasmPlugin resources

Install after upstream prerequisites are ready:

```bash
helm upgrade --install code-code-istio-platform deploy/k8s/charts/istio-platform \
  --namespace istio-system \
  --create-namespace \
  -f deploy/k8s/charts/istio-platform/examples/local.yaml
```

Prerequisites:

- Gateway API CRDs
- cert-manager
- trust-manager
- Istio Ambient base, `istiod`, `istio-cni`, `ztunnel`, and gateway

This chart has no external Secret dependency.

Notes:

- Prefer configuring tracing providers in `istiod` `meshConfig.defaultProviders` for mesh-wide defaults; enable `components.telemetry.enabled` only when you need Telemetry API overrides.
