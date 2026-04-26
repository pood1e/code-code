# cluster-bootstrap

`cluster-bootstrap` owns cluster-level prerequisites that must exist before the platform baseline is installed.

It currently renders:

- required platform namespaces
- vendored Gateway API CRDs under `crds/`

Install:

```bash
helm upgrade --install code-code-cluster-bootstrap deploy/k8s/charts/cluster-bootstrap \
  --namespace code-code \
  --create-namespace \
  -f deploy/k8s/charts/cluster-bootstrap/examples/local.yaml
```

Values contract:

- `global.*` defines the namespace names used by the rest of the release flow.
- `namespaces.enabled` toggles namespace creation.

This chart has no external Secret dependency.
