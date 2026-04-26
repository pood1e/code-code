# platform

`platform` owns the required platform application workloads.

It currently renders:

- 11 platform services
- service accounts and RBAC
- runtime namespace RBAC and network policies
- `cli-runtime-image-build-config`
- `cli-runtime-image-build` ServiceAccount in the run namespace
- `code-code-egress-policy` ConfigMap
- operator console ingress
- `AgentRunResource` CRD under `crds/`

Default `code-code-egress-policy` behavior:
- includes one preset HTTP proxy (`preset-proxy`)
- `preset-proxy` endpoint defaults to `${networkEgressPolicy.presetProxyUrl}`
- seeds custom proxy rules for `raw.githubusercontent.com` and model-catalog upstream hosts (GitHub Models, Cerebras, NVIDIA Integrate, Hugging Face, ModelScope, OpenRouter)
- keeps `external_rule_set` configured as `action=proxy` + `proxy_id=preset-proxy` (disabled until explicitly enabled)
- persists external AutoProxy load status in `external-rule-set-status.json` and avoids per-host Istio fanout for external rule sets

Install:

```bash
helm upgrade --install code-code-platform deploy/k8s/charts/platform \
  --namespace code-code \
  --create-namespace \
  -f deploy/k8s/charts/platform/examples/local.yaml
```

Required external resources:

- `${global.databaseSecretName}` in the platform namespace with key `${global.databaseSecretKey}`
- `${global.trustBundleConfigMapName}` in the platform namespace

Optional external resources:

- `${global.registryAuthSecretName}` in the platform namespace when runtime image registry auth is required
- `${consoleIngress.tlsSecretName}` when `consoleIngress.tlsEnabled=true`

This chart assumes `infrastructure-core`, Temporal, and upstream Istio prerequisites are already installed.
