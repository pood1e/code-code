# infrastructure-core

`infrastructure-core` owns the required runtime baseline for the platform.

It currently renders:

- PostgreSQL
- NATS
- OpenTelemetry Collector
- Prometheus
- Blackbox Exporter (health probes)
- Alertmanager

Install:

```bash
helm upgrade --install code-code-infrastructure-core deploy/k8s/charts/infrastructure-core \
  --namespace code-code \
  --create-namespace \
  -f deploy/k8s/charts/infrastructure-core/examples/baseline.yaml
```

Required Secrets:

- `${global.postgresSecretName}` in `${global.infraNamespace}` with `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`
- `${global.alertmanagerReceiversSecretName}` in `${global.observabilityNamespace}` with `wechat-api-secret`

Notes:

- `otelCollector.tempoEnabled=false` is the baseline mode.
- Enable Tempo integration only when `infrastructure-addons` installs Tempo.
- Health status is collected as `probe_success{job="platform-health",check="..."}` from Blackbox probes.
