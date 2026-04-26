# Local Runtime

## responsibility

Own the local developer runtime path for building images, publishing them to a local registry, and deploying to the current Kubernetes context.

## external fields

- local image registry: `localhost:5001/`
- registry container: `code-code-registry`
- optional local proxy overrides: `deploy/local.proxy.env`, `deploy/local.proxy.sh` (both gitignored)
- optional local ingress host overrides via `deploy/local.proxy.env`: `LOCAL_INGRESS_BIND_IP`, `CONSOLE_INGRESS_HOST`, `KIALI_INGRESS_HOST`, `GRAFANA_INGRESS_HOST`

## implementation notes

`deploy/local.sh` is the local entrypoint. It ensures the local registry exists and delegates image build and rollout to `deploy/release.sh`.

`deploy/local.sh` does not create or configure any specific cluster type. Cluster bootstrap and registry mirroring are environment-owned setup concerns.

The local registry is the source for locally built `code-code/*` images only.

The local registry is created with tag deletion enabled. If an existing registry container predates this setting, `deploy/local.sh` warns so it can be recreated before validating CLI image retention.

Local builds default to the `app` group. Runtime images such as egress and agent CLI images are built only when `runtime` is requested.

Optional environment-specific helper scripts can still be used, but they are outside the default local pipeline contract.

For Colima built-in K3s mirror configuration and development cache setup, see `docs/deploy/k3s-registry-mirrors.md`.
