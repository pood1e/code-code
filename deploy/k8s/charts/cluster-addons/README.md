# cluster-addons

`cluster-addons` owns optional cluster-scoped add-ons that are not required for baseline platform availability.

It currently renders:

- `metrics-server`

Install:

```bash
helm upgrade --install code-code-cluster-addons deploy/k8s/charts/cluster-addons \
  --namespace code-code \
  --create-namespace \
  -f deploy/k8s/charts/cluster-addons/examples/metrics-server.yaml
```

Values contract:

- `metricsServer.enabled` toggles the addon.
- `metricsServer.image` pins the published upstream image.

This chart has no external Secret dependency.
