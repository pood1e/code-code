# platform

![Version: 0.1.0](https://img.shields.io/badge/Version-0.1.0-informational?style=flat-square) ![Type: application](https://img.shields.io/badge/Type-application-informational?style=flat-square) ![AppVersion: 0.1.0](https://img.shields.io/badge/AppVersion-0.1.0-informational?style=flat-square)

code-code platform control-plane services (auth / model / provider / agent-runtime / cli-runtime / chat / console).

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
helm upgrade --install code-code-platform deploy/charts/platform \
  --namespace <namespace> \
  --create-namespace \
  -f deploy/charts/platform/examples/<env>.yaml
```

Create the credential material encryption Secret before starting auth service:

```bash
kubectl -n <namespace> create secret generic platform-credential-encryption \
  --from-literal=key="$(openssl rand -base64 32)"
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
| global.imageRegistry | string | `""` | global.imageRegistry is the optional registry prefix used for platform images. |
| global.imageTag | string | `"0.0.0"` | global.imageTag is the shared image tag for platform images. |
| global.runNamespace | string | `"code-code-runs"` | global.runNamespace is the namespace used by runtime jobs and per-run RBAC. |
| global.consoleNamespace | string | `"code-code-console"` | global.consoleNamespace is the namespace used by console web/API workloads and routes. |
| global.showcaseNamespace | string | `"code-code-showcase"` | global.showcaseNamespace is the namespace used by showcase web/API workloads and routes. |
| global.infraNamespace | string | `"code-code-infra"` | global.infraNamespace is the namespace used by infrastructure services. |
| global.observabilityNamespace | string | `"code-code-observability"` | global.observabilityNamespace is the namespace used by observability services. |
| global.networkNamespace | string | `"code-code-net"` | global.networkNamespace is the namespace used by network egress components. |
| global.natsUrl | string | `"nats://nats.code-code-infra.svc.cluster.local:4222"` | global.natsUrl is the NATS address used by Temporal-enabled services. |
| global.temporalAddress | string | `"temporal-frontend.code-code-infra.svc.cluster.local:7233"` | global.temporalAddress is the Temporal frontend address. |
| global.temporalNamespace | string | `"temporal-system"` | global.temporalNamespace is the Temporal namespace used by platform workflows. |
| global.databaseSecretName | string | `"postgres-auth"` | global.databaseSecretName is the Secret name containing DATABASE_URL. |
| global.credentialEncryptionSecretName | string | `"platform-credential-encryption"` | Secret name containing the base64 AES credential material encryption key. |
| global.credentialEncryptionSecretKey | string | `"key"` | Secret key containing the base64 AES credential material encryption key. |
| global.credentialEncryptionKeyId | string | `"local-v1"` | Active key identifier stored with encrypted credential material. |
| global.registryAuthSecretName | string | `"cli-runtime-image-build-registry-auth"` | global.registryAuthSecretName is the optional registry auth Secret used by build services. |
| global.trustBundleConfigMapName | string | `"code-code-egress-trust-bundle"` | global.trustBundleConfigMapName is the ConfigMap name for the egress trust bundle. |
| global.consoleBaseUrl | string | `"http://console.placeholder.invalid"` | global.consoleBaseUrl is the OAuth callback base URL for auth flows. Override per-environment. |
| global.showcaseBaseUrl | string | `"http://showcase.placeholder.invalid"` | global.showcaseBaseUrl is the public showcase base URL printed after deploy. Override per-environment. |
| global.cliOutputSidecarImageName | string | `"cli-output-sidecar"` | global.cliOutputSidecarImageName is the image name used by agent-runtime for the CLI sidecar. |
| defaults.service.type | string | `"ClusterIP"` | defaults.service.type is the baseline Service type for components that expose ports. |
| defaults.hpa.enabled | bool | `false` | defaults.hpa.enabled toggles autoscaling by default for components. |
| defaults.hpa.minReplicas | int | `1` | defaults.hpa.minReplicas is the default HPA minimum replica count. |
| defaults.hpa.maxReplicas | int | `3` | defaults.hpa.maxReplicas is the default HPA maximum replica count. |
| defaults.hpa.targetCPUUtilizationPercentage | int | `70` | defaults.hpa.targetCPUUtilizationPercentage is the default CPU target for HPAs. |
| defaults.pdb.enabled | bool | `false` | defaults.pdb.enabled toggles disruption budgets by default for components. |
| defaults.pdb.minAvailable | int | `1` | defaults.pdb.minAvailable is the default PodDisruptionBudget minimum available count. |
| cliImageBuildConfig.imageRegistryPrefix | string | `""` | cliImageBuildConfig.imageRegistryPrefix is the published registry prefix for built runtime images. |
| cliImageBuildConfig.imageRegistryLookupPrefix | string | `""` | cliImageBuildConfig.imageRegistryLookupPrefix is the lookup registry prefix used by the services. |
| cliImageBuildConfig.imageRegistryLookupInsecure | string | `"false"` | cliImageBuildConfig.imageRegistryLookupInsecure controls whether registry lookup skips TLS verification. |
| cliImageBuildConfig.sourceContext | string | `""` | cliImageBuildConfig.sourceContext is the source repository context recorded in image build metadata. |
| cliImageBuildConfig.sourceRevision | string | `"main"` | cliImageBuildConfig.sourceRevision is the source revision recorded in image build metadata. |
| consoleRoute.enabled | bool | `true` | consoleRoute.enabled toggles the shared console HTTPRoute. |
| consoleRoute.host | string | `"console.placeholder.invalid"` | consoleRoute.host is the hostname published by the console HTTPRoute. |
| consoleRoute.extraHosts | list | `[]` | consoleRoute.extraHosts is the additional hostname list published by the same console HTTPRoute. |
| consoleRoute.parentRef.name | string | `"platform-ingress"` | consoleRoute.parentRef.name is the shared Gateway name. |
| consoleRoute.parentRef.namespace | string | `"code-code-net"` | consoleRoute.parentRef.namespace is the shared Gateway namespace. |
| consoleRoute.parentRef.sectionName | string | `"http"` | consoleRoute.parentRef.sectionName is the Gateway listener section name. |
| showcaseRoute.enabled | bool | `true` | showcaseRoute.enabled toggles the shared showcase HTTPRoute. |
| showcaseRoute.host | string | `"showcase.placeholder.invalid"` | showcaseRoute.host is the hostname published by the showcase HTTPRoute. |
| showcaseRoute.extraHosts | list | `[]` | showcaseRoute.extraHosts is the additional hostname list published by the same showcase HTTPRoute. |
| showcaseRoute.parentRef.name | string | `"platform-ingress"` | showcaseRoute.parentRef.name is the shared Gateway name. |
| showcaseRoute.parentRef.namespace | string | `"code-code-net"` | showcaseRoute.parentRef.namespace is the shared Gateway namespace. |
| showcaseRoute.parentRef.sectionName | string | `"http"` | showcaseRoute.parentRef.sectionName is the Gateway listener section name. |
| runtimeServiceAccounts.cliImageBuild.enabled | bool | `true` | runtimeServiceAccounts.cliImageBuild.enabled toggles the auxiliary ServiceAccount for CLI image builds. |
| runtimeServiceAccounts.cliImageBuild.name | string | `"cli-runtime-image-build"` | runtimeServiceAccounts.cliImageBuild.name is the ServiceAccount name used by CLI image build jobs. |
| authorizationPolicies.enabled | bool | `true` | authorizationPolicies.enabled renders L4 AuthorizationPolicy baselines for platform-owned workloads. |
| components.auth.enabled | bool | `true` | Toggle deployment of the auth service. |
| components.auth.credentialEncryptionKey | bool | `true` | Mount credential material encryption key environment variables into auth service. |
| components.model.enabled | bool | `true` | Toggle deployment of the model service. |
| components.model.cronJob.enabled | bool | `true` | cronJob.enabled toggles the model sync CronJob. |
| components.model.cronJob.schedule | string | `"0 * * * *"` | cronJob.schedule is the cron expression controlling sync frequency. |
| components.provider.enabled | bool | `true` | Toggle deployment of the provider service. |
| components.egress.enabled | bool | `true` | Toggle deployment of the egress service. |
| components.profile.enabled | bool | `true` | Toggle deployment of the profile service. |
| components.support.enabled | bool | `true` | Toggle deployment of the support service. |
| components.cliRuntime.enabled | bool | `true` | Toggle deployment of the CLI runtime service. |
| components.agentRuntime.enabled | bool | `true` | Toggle deployment of the agent runtime service. |
| components.chat.enabled | bool | `true` | Toggle deployment of the chat service. |
| components.consoleApi.enabled | bool | `true` | Toggle deployment of the console API service. |
| components.consoleWeb.enabled | bool | `true` | Toggle deployment of the console web service. |
| components.showcaseApi.enabled | bool | `true` | Toggle deployment of the showcase API service. |
| components.showcaseWeb.enabled | bool | `true` | Toggle deployment of the showcase web service. |
