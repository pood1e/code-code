# cluster-bootstrap

![Version: 0.1.0](https://img.shields.io/badge/Version-0.1.0-informational?style=flat-square) ![Type: application](https://img.shields.io/badge/Type-application-informational?style=flat-square) ![AppVersion: v1.4.0](https://img.shields.io/badge/AppVersion-v1.4.0-informational?style=flat-square)

Cluster-scoped bootstrap resources for the code-code platform.

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
helm upgrade --install code-code-cluster-bootstrap deploy/charts/cluster-bootstrap \
  --namespace <namespace> \
  --create-namespace \
  -f deploy/charts/cluster-bootstrap/examples/<env>.yaml
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
| global.partOf | string | `"code-code"` | Shared app.kubernetes.io/part-of label. |
| global.platformNamespace | string | `"code-code"` | Namespace for platform control-plane services. |
| global.consoleNamespace | string | `"code-code-console"` | Namespace for operator-facing console workloads and routes. |
| global.showcaseNamespace | string | `"code-code-showcase"` | Namespace for public showcase workloads and routes. |
| global.infraNamespace | string | `"code-code-infra"` | Namespace for shared infrastructure services. |
| global.observabilityNamespace | string | `"code-code-observability"` | Namespace for observability workloads. |
| global.networkNamespace | string | `"code-code-net"` | Namespace for egress gateway and network resources. |
| global.runNamespace | string | `"code-code-runs"` | Namespace for runtime jobs and per-run RBAC. |
| namespaces.enabled | bool | `true` | Toggle creation of the required platform namespaces. |
