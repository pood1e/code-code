# infrastructure-core

![Version: 0.1.0](https://img.shields.io/badge/Version-0.1.0-informational?style=flat-square) ![Type: application](https://img.shields.io/badge/Type-application-informational?style=flat-square) ![AppVersion: 0.1.0](https://img.shields.io/badge/AppVersion-0.1.0-informational?style=flat-square)

Required infrastructure services for the code-code platform.

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
helm upgrade --install code-code-infrastructure-core deploy/charts/infrastructure-core \
  --namespace <namespace> \
  --create-namespace \
  -f deploy/charts/infrastructure-core/examples/<env>.yaml
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
| global.consoleNamespace | string | `"code-code-console"` | Namespace for operator-facing console workloads. |
| global.showcaseNamespace | string | `"code-code-showcase"` | Namespace for public showcase workloads. |
| global.postgresSecretName | string | `"postgres-auth"` | Secret name with POSTGRES_DB, POSTGRES_USER, and POSTGRES_PASSWORD. |
| global.alertmanagerReceiversSecretName | string | `"alertmanager-receivers"` | Secret name with Alertmanager receiver credentials. |
| postgres.enabled | bool | `true` | Enable or disable PostgreSQL. |
| postgres.storageSize | string | `"10Gi"` | PVC size for PostgreSQL data storage. |
| nats.enabled | bool | `true` | Enable or disable NATS JetStream. |
| nats.storageSize | string | `"5Gi"` | PVC size for NATS data storage. |
| otelCollector.enabled | bool | `true` | Enable or disable the OpenTelemetry Collector. |
| otelCollector.image | string | `"otel/opentelemetry-collector-contrib:0.150.1"` | OpenTelemetry Collector Contrib image. |
| otelCollector.tempoEnabled | bool | `false` | Send traces to Tempo when infrastructure-addons also enables Tempo. |
| otelCollector.tempoEndpoint | string | `""` | Explicit Tempo OTLP endpoint override; empty uses the in-cluster default. |
| prometheus.enabled | bool | `true` | Enable or disable Prometheus. |
| prometheus.storageSize | string | `"10Gi"` | PVC size for Prometheus data storage. |
| blackbox.enabled | bool | `true` | Enable or disable the Blackbox Exporter. |
| blackbox.module | string | `"http_2xx"` | Blackbox probe module used for generated health checks. |
| providerHostTelemetry.enabled | bool | `true` | Enable or disable provider host latency telemetry. |
| providerHostTelemetry.module | string | `"provider_http_reachable"` | Blackbox probe module used for provider host latency telemetry. |
| providerHostTelemetry.scrapeInterval | string | `"30s"` | Prometheus scrape interval for provider host latency telemetry. |
| providerHostTelemetry.scrapeTimeout | string | `"12s"` | Prometheus scrape timeout for provider host latency telemetry. Keep this above moduleTimeout so timeout samples can be returned. |
| providerHostTelemetry.refreshInterval | string | `"30s"` | Prometheus HTTP service discovery refresh interval for provider host targets. |
| providerHostTelemetry.moduleTimeout | string | `"10s"` | Blackbox module timeout for provider host latency telemetry. |
| providerHostTelemetry.discoveryUrl | string | `""` | Optional override for the provider host target discovery URL. |
| providerHostTelemetry.resources | object | requests `25m/64Mi`, limits `500m/256Mi` | Resource budget for the provider host Blackbox Exporter. |
| healthChecks.enabled | bool | `true` | Enable or disable generated platform health probes. |
| healthChecks.additionalTargets | list | `[]` | Additional Blackbox probe targets appended to the default platform set. |
| alertmanager.enabled | bool | `true` | Enable or disable Alertmanager. |
| alertmanager.storageSize | string | `"1Gi"` | PVC size for Alertmanager data storage. |
| alertmanager.wechat.corpId | string | `"<REPLACE_WITH_WECHAT_CORP_ID>"` | WeCom receiver identity placeholders required by the Alertmanager config. |
