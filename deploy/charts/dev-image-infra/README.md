# dev-image-infra

![Version: 0.1.0](https://img.shields.io/badge/Version-0.1.0-informational?style=flat-square) ![Type: application](https://img.shields.io/badge/Type-application-informational?style=flat-square) ![AppVersion: 2.8.3](https://img.shields.io/badge/AppVersion-2.8.3-informational?style=flat-square)

Development-only in-cluster image registry and pull-through caches.

**Homepage:** <https://github.com/pood1e/code-code>

## Maintainers

| Name | Email | Url |
| ---- | ------ | --- |
| code-code platform team |  |  |

## Source Code

* <https://github.com/pood1e/code-code>

## Requirements

Kubernetes: `>=1.31.0-0 <1.37.0-0`

## Install

Install from the repository root:

```bash
helm upgrade --install code-code-dev-image-infra deploy/charts/dev-image-infra \
  --namespace <namespace> \
  --create-namespace \
  -f deploy/charts/dev-image-infra/examples/<env>.yaml
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
| global.infraNamespace | string | `"code-code-infra"` | Namespace where the in-cluster registry and caches are deployed. |
| registry.enabled | bool | `true` | Enable or disable the writable in-cluster registry. |
| registry.service.nodePort | int | `30500` | NodePort exposed for the writable registry service. |
| registry.storage.persistentVolumeClaim | string | `""` | Existing PVC name for registry storage; empty uses ephemeral storage. |
| cache.enabled | bool | `true` | Enable or disable the pull-through cache tier. |
| cache.mirrors.dockerIo.enabled | bool | `true` | Enable or disable the docker.io pull-through cache. |
| cache.mirrors.dockerIo.nodePort | int | `30502` | NodePort exposed for the docker.io cache. |
| cache.mirrors.dockerIo.persistentVolumeClaim | string | `""` | Existing PVC name for the docker.io cache; empty uses ephemeral storage. |
| cache.mirrors.registryK8sIo.enabled | bool | `true` | Enable or disable the registry.k8s.io pull-through cache. |
| cache.mirrors.registryK8sIo.nodePort | int | `30503` | NodePort exposed for the registry.k8s.io cache. |
| cache.mirrors.registryK8sIo.persistentVolumeClaim | string | `""` | Existing PVC name for the registry.k8s.io cache; empty uses ephemeral storage. |
| cache.mirrors.quayIo.enabled | bool | `true` | Enable or disable the quay.io pull-through cache. |
| cache.mirrors.quayIo.nodePort | int | `30504` | NodePort exposed for the quay.io cache. |
| cache.mirrors.quayIo.persistentVolumeClaim | string | `""` | Existing PVC name for the quay.io cache; empty uses ephemeral storage. |
