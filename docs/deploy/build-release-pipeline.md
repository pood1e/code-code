# Build And Release Pipeline

## Summary

`deploy/release.sh` is the only supported entrypoint for image build, image push, baseline deploy, addon deploy, chart validation, and chart packaging.

The release flow is split into:

- baseline charts: `cluster-bootstrap`, `infrastructure-core`, `platform`, `istio-platform`
- optional addon charts: `cluster-addons`, `infrastructure-addons`, `dev-image-infra`, `platform-notifications`
- pinned upstream releases: ingress-nginx, cert-manager, trust-manager, Istio Ambient, Temporal, Kiali operator

## Release Order

Baseline `deploy` installs resources in this order:

1. ingress-nginx
2. `cluster-bootstrap`
3. `infrastructure-core`
4. Temporal
5. cert-manager and trust-manager
6. upstream Istio Ambient and egress gateway
7. `istio-platform`
8. `platform`

Optional `deploy-addon` installs one of:

- `cluster-addons`
- `infrastructure-addons`
- `dev-image-infra` (development only)
- `platform-notifications`
- `all`

`infrastructure-addons` components are explicit:

- `grafana`
- `tempo`
- `kiali`
- `cloudflare-ddns`
- `all`

## Chart Ownership

- `deploy/k8s/charts/cluster-bootstrap`
  - required namespaces
  - vendored Gateway API CRDs
- `deploy/k8s/charts/cluster-addons`
  - optional `metrics-server`
- `deploy/k8s/charts/dev-image-infra`
  - development-only in-cluster registry and pull-through cache instances
- `deploy/k8s/charts/infrastructure-core`
  - PostgreSQL, NATS, OTel collector, Prometheus, Alertmanager
- `deploy/k8s/charts/infrastructure-addons`
  - Grafana, Tempo, Kiali CR, cloudflare-ddns
- `deploy/k8s/charts/platform`
  - required application workloads
- `deploy/k8s/charts/platform-notifications`
  - optional notification subsystem
- `deploy/k8s/charts/istio-platform`
  - platform-managed Istio custom resources

## CLI

```bash
deploy/release.sh build [app|runtime|all|target...]
deploy/release.sh push [app|runtime|all|target...]
deploy/release.sh deploy
deploy/release.sh deploy-addon <cluster-addons|infrastructure-addons|dev-image-infra|platform-notifications|all> [grafana|tempo|kiali|cloudflare-ddns|registry|cache|all]
deploy/release.sh validate
deploy/release.sh package-charts
deploy/release.sh push-charts
deploy/release.sh clean [app|runtime|all|target...]
deploy/release.sh build-local-web
deploy/release.sh build-local-go <service>
```

Daily entrypoint wrapper:

```bash
deploy/dev.sh setup
deploy/dev.sh build [app|runtime|all|target...]
deploy/dev.sh push [app|runtime|all|target...]
deploy/dev.sh deploy
deploy/dev.sh addon <cluster-addons|infrastructure-addons|dev-image-infra|platform-notifications|all> [grafana|tempo|kiali|cloudflare-ddns|registry|cache|all]
deploy/dev.sh up [app|runtime|all|target...]
deploy/dev.sh validate
deploy/dev.sh status
deploy/dev.sh restart <deployment> [namespace]
deploy/dev.sh logs <deployment> [namespace] [--follow]
```

## Environment Contract

Common deploy inputs:

- `IMAGE_REGISTRY`
- `IMAGE_TAG`
- `NAMESPACE`
- `INFRA_NAMESPACE`
- `OBSERVABILITY_NAMESPACE`
- `RUN_NAMESPACE`
- `FORCE_RESTART`
- `DEV_IMAGE_INFRA_HELM_RELEASE`
- `DEV_IMAGE_INFRA_REGISTRY_IMAGE`
- `DEV_IMAGE_INFRA_REGISTRY_SERVICE_TYPE`
- `DEV_IMAGE_INFRA_REGISTRY_NODE_PORT`
- `DEV_IMAGE_INFRA_CACHE_IMAGE`
- `DEV_IMAGE_INFRA_CACHE_SERVICE_TYPE`
- `DEV_IMAGE_INFRA_CACHE_DOCKER_IO_NODE_PORT`
- `DEV_IMAGE_INFRA_CACHE_REGISTRY_K8S_IO_NODE_PORT`
- `DEV_IMAGE_INFRA_CACHE_QUAY_IO_NODE_PORT`
- `INGRESS_NGINX_HELM_RELEASE`
- `INGRESS_NGINX_NAMESPACE`
- `INGRESS_NGINX_VERSION`
- `INGRESS_NGINX_HELM_TIMEOUT`
- `INGRESS_NGINX_VALUES_FILE`
- `LOCAL_INGRESS_BIND_IP`
- `CONSOLE_INGRESS_HOST`
- `CONSOLE_INGRESS_SSL_REDIRECT`
- `CONSOLE_INGRESS_TLS_ENABLED`
- `CONSOLE_INGRESS_TLS_SECRET_NAME`
- `PLATFORM_KUBERNETES_SERVICE_CIDR`
- `PLATFORM_API_SERVER_CIDR`
- `NOTIFICATION_INGRESS_PRIMARY_HOST`
- `NOTIFICATION_INGRESS_SECONDARY_HOST`
- `NOTIFICATION_INGRESS_TLS_SECRET_NAME`
- `CLOUDFLARE_DDNS_DOMAINS`
- `CLOUDFLARE_DDNS_PROXIED`
- `CLOUDFLARE_DDNS_IP4_PROVIDER`
- `CLOUDFLARE_DDNS_IP6_PROVIDER`
- `CLOUDFLARE_DDNS_UPDATE_CRON`
- `CLOUDFLARE_DDNS_UPDATE_ON_START`
- `KIALI_INGRESS_CLASS_NAME`
- `KIALI_INGRESS_HOST`
- `KIALI_INGRESS_PATH`
- `KIALI_INGRESS_TLS_ENABLED`
- `KIALI_INGRESS_TLS_SECRET_NAME`
- `GRAFANA_INGRESS_CLASS_NAME`
- `GRAFANA_INGRESS_HOST`
- `GRAFANA_INGRESS_PATH`
- `GRAFANA_INGRESS_TLS_ENABLED`
- `GRAFANA_INGRESS_TLS_SECRET_NAME`
- `DEPLOY_EGRESS_PREFLIGHT`

Required pre-created Secrets:

- `${INFRA_NAMESPACE}/postgres-auth` with `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `DATABASE_URL`
- `${NAMESPACE}/postgres-auth` with `DATABASE_URL`
- `${OBSERVABILITY_NAMESPACE}/alertmanager-receivers` with `wechat-api-secret`
- `${OBSERVABILITY_NAMESPACE}/grafana-admin` with `GF_SECURITY_ADMIN_USER`, `GF_SECURITY_ADMIN_PASSWORD` when deploying `grafana`
- `${INFRA_NAMESPACE}/cloudflare-ddns-token` with `token` when deploying `cloudflare-ddns`
- `${NAMESPACE}/notification-apprise-urls` with `urls` when deploying `platform-notifications`
- `${NAMESPACE}/wecom-callback` with `encoding-aes-key`, `token` when deploying `platform-notifications`
- `${NAMESPACE}/wecom-robot-default-callback` with `encoding-aes-key`, `token` when deploying `platform-notifications`

Chart packaging inputs:

- `CHART_VERSION`
- `CHART_APP_VERSION`
- `CHART_PACKAGE_DIR`
- `CHART_OCI_REGISTRY`

## Validation

`deploy/release.sh validate` performs:

- workflow manifest validation
- `helm lint` for all local charts
- `helm template` for generated release values
- `helm template` for chart example values
- upstream Temporal and Kiali operator template checks
- local chart package smoke

## Notes

- Gateway API CRDs are vendored in `cluster-bootstrap/crds/`; deploy no longer fetches them from GitHub at runtime.
- Prometheus is part of the required baseline because business metrics enter there.
- ingress-nginx is now required in baseline deploy; `INGRESS_NGINX_VALUES_FILE` can be used for environment-specific service exposure.
- `dev-image-infra` is development-only; production environments should use runtime-level registry mirrors or managed registry cache services.
- Grafana, Tempo, Kiali, metrics-server, cloudflare-ddns, and notifications stay off the baseline path unless explicitly requested.
- Deploy scripts no longer run `kubectl apply` to create or mutate manifests; chart and upstream releases are installed through Helm only.
- Missing required Secrets now fail fast instead of being auto-generated by release scripts.
- Local proxy overrides can be loaded through gitignored `deploy/local.proxy.env` or `deploy/local.proxy.sh`.
- Local ingress host overrides should stay in gitignored `deploy/local.proxy.env`; `LOCAL_INGRESS_BIND_IP` can derive `*.nip.io` hosts for console, Kiali, and Grafana.
