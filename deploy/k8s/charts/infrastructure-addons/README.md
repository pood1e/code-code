# infrastructure-addons

`infrastructure-addons` owns optional observability and integration add-ons.

It currently renders:

- Grafana
- Tempo
- Loki
- Alloy
- Kiali custom resource
- cloudflare-ddns

Install:

```bash
helm upgrade --install code-code-infrastructure-addons deploy/k8s/charts/infrastructure-addons \
  --namespace code-code \
  --create-namespace \
  -f deploy/k8s/charts/infrastructure-addons/examples/observability.yaml
```

Required Secrets:

- `${global.grafanaAdminSecretName}` in `${global.observabilityNamespace}` with `GF_SECURITY_ADMIN_USER` and `GF_SECURITY_ADMIN_PASSWORD` when `grafana.enabled=true`
- `${cloudflareDdns.secretName}` in `${global.infraNamespace}` with `token` when `cloudflareDdns.enabled=true`

Notes:

- `tempo.enabled=true` should be paired with `infrastructure-core` rendered with `otelCollector.tempoEnabled=true`.
- `loki.enabled=true` deploys Loki in single-binary mode with filesystem storage (official quick-start shape for small/dev workloads).
- `alloy.enabled=true` deploys Alloy using Kubernetes API log collection (`loki.source.kubernetes`) and writes to Loki by default. Override `alloy.lokiWriteUrl` to send logs to an external Loki endpoint.
- `kiali.enabled=true` assumes the Kiali operator is installed separately.
- `kiali.ingress.enabled=true` publishes Kiali through ingress. Default host-mode is `path=/` with `webRoot=/`; if using a subpath, keep `kiali.ingress.path` aligned with `kiali.webRoot`.
- `grafana.ingress.enabled=true` publishes Grafana through ingress. Default host-mode is `path=/` with `rootUrl=/`; if using a subpath, keep `grafana.ingress.path` aligned with `grafana.rootUrl`.
- Grafana Explore requires `Editor` or `Admin`. For anonymous local dev, set `grafana.anonymousOrgRole=Editor`.

Official references used for defaults:

- Loki deployment modes and monolithic install: https://grafana.com/docs/loki/latest/get-started/deployment-modes/ and https://grafana.com/docs/loki/latest/setup/install/helm/install-monolithic/
- Loki local filesystem configuration example: https://grafana.com/docs/loki/latest/configure/examples/configuration-examples/
- Alloy on Kubernetes and Kubernetes logs to Loki: https://grafana.com/docs/alloy/latest/set-up/install/kubernetes/ and https://grafana.com/docs/alloy/latest/collect/logs-in-kubernetes/
