# K3s Registry Mirrors

## Scope

This document defines the node-level runtime configuration for image registry mirrors in K3s environments (including Colima built-in K3s).

## Why

- Runtime image pulls are decided by containerd on each node.
- In-cluster Deployments alone do not change node pull behavior.
- To avoid repeated external pulls, configure `registries.yaml` on each node.

## Development Option

Install the development-only image infrastructure chart:

```bash
deploy/release.sh deploy-addon dev-image-infra all
```

By default, this exposes:

- local writable registry on NodePort `30500`
- pull-through cache for:
  - `docker.io` on `30502`
  - `registry.k8s.io` on `30503`
  - `quay.io` on `30504`

## Node Runtime Configuration

On each K3s node, configure `/etc/rancher/k3s/registries.yaml`:

```yaml
mirrors:
  docker.io:
    endpoint:
      - "http://127.0.0.1:30502"
  registry.k8s.io:
    endpoint:
      - "http://127.0.0.1:30503"
  quay.io:
    endpoint:
      - "http://127.0.0.1:30504"
  "<NODE_IP>:30500":
    endpoint:
      - "http://127.0.0.1:30500"
```

`<NODE_IP>:30500` is the registry endpoint used in image references from build/push side.

Restart K3s after updating:

```bash
sudo systemctl restart k3s
```

For Colima built-in K3s, run equivalent commands inside the Colima VM.

## Production Guidance

- Prefer managed registry and managed pull-through cache capabilities.
- Keep node mirror configuration managed by cluster runtime/infrastructure layer.
- Do not treat development chart resources as production baseline.
