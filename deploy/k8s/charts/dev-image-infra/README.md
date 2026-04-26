# dev-image-infra

`dev-image-infra` owns development-only image infrastructure inside the cluster.

It currently renders:

- writable local OCI registry (`registry`)
- pull-through cache instances for `docker.io`, `registry.k8s.io`, and `quay.io`

Install:

```bash
helm upgrade --install code-code-dev-image-infra deploy/k8s/charts/dev-image-infra \
  --namespace code-code-infra \
  --create-namespace \
  -f deploy/k8s/charts/dev-image-infra/examples/colima-k3s.yaml
```

Notes:

- This chart is for development and debugging only, not for production baseline.
- Runtime image pull behavior is still controlled at node runtime level (for K3s, `registries.yaml` on each node).
- For production, prefer managed registry and managed pull-through cache capabilities.
