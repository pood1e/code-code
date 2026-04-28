# Upstream chart values overlays

Values files used to install upstream Helm charts.

Current tested upstream baseline:

- Istio Ambient: `1.29.2` (`base`, `istiod`, `cni`, `ztunnel` official charts)
- Gateway API CRDs: `v1.4.0` Experimental channel, bundled in `deploy/charts/cluster-bootstrap/crds`

Istio 1.29 is officially supported on Kubernetes 1.31-1.35. Its current
official Gateway API tasks and Ambient Helm install docs use Gateway API
`v1.4.0` Experimental-channel CRDs; Istio 1.29.2 ignores `TLSRoute` CRD
versions `v1.5+`.

Apply Gateway API CRDs with Kubernetes server-side apply:

```bash
make -C deploy gateway-api-crds-apply
```

| File | Upstream chart | Install |
| ---- | -------------- | ------- |
| `istiod.yaml` | [istio/istiod](https://istio.io/latest/docs/ambient/install/helm/) | `helm repo add istio https://istio-release.storage.googleapis.com/charts`<br>`helm upgrade --install istio-base istio/base --version 1.29.2 -n istio-system --create-namespace --wait`<br>`helm upgrade --install istiod istio/istiod --version 1.29.2 -n istio-system -f deploy/values/istiod.yaml --wait`<br>`helm upgrade --install istio-cni istio/cni --version 1.29.2 -n istio-system --wait`<br>`helm upgrade --install ztunnel istio/ztunnel --version 1.29.2 -n istio-system --wait` |
| `temporal.yaml` | [temporalio/temporal](https://github.com/temporalio/helm-charts) | `helm repo add temporalio https://go.temporal.io/helm-charts`<br>`helm install temporal temporalio/temporal -n code-code-infra -f deploy/values/temporal.yaml --create-namespace` |

Pre-create the `postgres-auth` Secret in `code-code-infra` (with key `POSTGRES_PASSWORD`) before installing Temporal — its schema job and frontend both consume it.
