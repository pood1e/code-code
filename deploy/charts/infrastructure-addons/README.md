# infrastructure-addons

![Version: 0.1.0](https://img.shields.io/badge/Version-0.1.0-informational?style=flat-square) ![Type: application](https://img.shields.io/badge/Type-application-informational?style=flat-square) ![AppVersion: 0.1.0](https://img.shields.io/badge/AppVersion-0.1.0-informational?style=flat-square)

Optional infrastructure addons for the code-code platform.

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
helm upgrade --install code-code-infrastructure-addons deploy/charts/infrastructure-addons \
  --namespace <namespace> \
  --create-namespace \
  -f deploy/charts/infrastructure-addons/examples/<env>.yaml
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
| global.observabilityAmbientPodOptOut | bool | `false` | Opt out observability pods from ambient sidecar enrollment when required. |
| global.grafanaAdminSecretName | string | `"grafana-admin"` | Secret name holding Grafana admin credentials. |
| tempo.enabled | bool | `false` | Enable or disable Tempo. |
| tempo.dataSize | string | `"2Gi"` | PVC size for Tempo data storage. |
| loki.enabled | bool | `false` | Enable or disable Loki. |
| loki.dataSize | string | `"10Gi"` | PVC size for Loki data storage. |
| loki.storageClassName | string | `""` | StorageClass override for Loki PVCs; empty uses the cluster default. |
| loki.retentionPeriod | string | `"168h"` | Retention period passed to the single-binary Loki config. |
| alloy.enabled | bool | `false` | Enable or disable Alloy log collection. |
| alloy.clusterName | string | `"code-code-local"` | Cluster name label attached to Alloy-emitted telemetry. |
| alloy.lokiWriteUrl | string | `""` | Override the Loki write URL; empty targets the in-cluster Loki service. |
| alloy.collectClusterEvents | bool | `true` | Collect Kubernetes event logs in addition to pod logs. |
| grafana.enabled | bool | `false` | Enable or disable Grafana. |
| grafana.service.type | string | `"ClusterIP"` | Grafana Service type. |
| grafana.service.nodePort | int | `32030` | NodePort exposed only when grafana.service.type is NodePort. |
| grafana.publicUrl | string | `""` | Public Grafana URL used by Kiali external links. |
| grafana.rootUrl | string | `"/"` | Root URL passed to Grafana for subpath deployments. |
| grafana.anonymousOrgRole | string | `"Viewer"` | Anonymous org role for local or shared dashboards. |
| grafana.viewersCanEdit | bool | `false` | Allow viewers to edit panels in local debugging setups. |
| grafana.exploreEnabled | bool | `true` | Toggle the Grafana Explore UI. |
| grafana.route.enabled | bool | `false` | Publish Grafana through a Gateway API HTTPRoute. |
| grafana.route.host | string | `"grafana.placeholder.invalid"` | External host served by the Grafana HTTPRoute. |
| grafana.route.extraHosts | list | `[]` | Additional hosts served by the Grafana HTTPRoute. |
| grafana.route.path | string | `"/"` | Path prefix served by the Grafana HTTPRoute. |
| grafana.route.parentRef.name | string | `"platform-ingress"` | Gateway name used by the Grafana HTTPRoute. |
| grafana.route.parentRef.namespace | string | `"code-code-net"` | Gateway namespace used by the Grafana HTTPRoute. |
| grafana.route.parentRef.sectionName | string | `"http"` | Gateway listener section used by the Grafana HTTPRoute. |
| cloudflareDdns.enabled | bool | `false` | Enable or disable cloudflare-ddns. |
| cloudflareDdns.secretName | string | `"cloudflare-ddns-token"` | Secret name holding the Cloudflare API token. |
| cloudflareDdns.domains | string | `"webhook.example.com"` | Comma-separated hostnames updated by cloudflare-ddns. |
| kiali.enabled | bool | `false` | Enable or disable Kiali resources. |
| kiali.service.type | string | `"ClusterIP"` | Kiali Service type. |
| kiali.service.port | int | `20001` | Kiali HTTP service port. |
| kiali.service.nodePort | int | `32031` | NodePort exposed only when kiali.service.type is NodePort. |
| kiali.webRoot | string | `"/"` | Kiali web root for subpath deployments. |
| kiali.route.enabled | bool | `false` | Publish Kiali through a Gateway API HTTPRoute. |
| kiali.route.host | string | `"kiali.placeholder.invalid"` | External host served by the Kiali HTTPRoute. |
| kiali.route.extraHosts | list | `[]` | Additional hosts served by the Kiali HTTPRoute. |
| kiali.route.path | string | `"/"` | Path prefix served by the Kiali HTTPRoute. |
| kiali.route.parentRef.name | string | `"platform-ingress"` | Gateway name used by the Kiali HTTPRoute. |
| kiali.route.parentRef.namespace | string | `"code-code-net"` | Gateway namespace used by the Kiali HTTPRoute. |
| kiali.route.parentRef.sectionName | string | `"http"` | Gateway listener section used by the Kiali HTTPRoute. |
