#!/usr/bin/env bash
# Helm chart rendering and release helpers.

readonly CLUSTER_BOOTSTRAP_CHART_DIR="${REPO_ROOT}/deploy/k8s/charts/cluster-bootstrap"
readonly CLUSTER_ADDONS_CHART_DIR="${REPO_ROOT}/deploy/k8s/charts/cluster-addons"
readonly DEV_IMAGE_INFRA_CHART_DIR="${REPO_ROOT}/deploy/k8s/charts/dev-image-infra"
readonly INFRASTRUCTURE_CORE_CHART_DIR="${REPO_ROOT}/deploy/k8s/charts/infrastructure-core"
readonly INFRASTRUCTURE_ADDONS_CHART_DIR="${REPO_ROOT}/deploy/k8s/charts/infrastructure-addons"
readonly PLATFORM_CHART_DIR="${REPO_ROOT}/deploy/k8s/charts/platform"
readonly PLATFORM_NOTIFICATIONS_CHART_DIR="${REPO_ROOT}/deploy/k8s/charts/platform-notifications"
readonly ISTIO_PLATFORM_CHART_DIR="${REPO_ROOT}/deploy/k8s/charts/istio-platform"

readonly LOCAL_CHART_DIRS=(
  "${CLUSTER_BOOTSTRAP_CHART_DIR}"
  "${CLUSTER_ADDONS_CHART_DIR}"
  "${DEV_IMAGE_INFRA_CHART_DIR}"
  "${INFRASTRUCTURE_CORE_CHART_DIR}"
  "${INFRASTRUCTURE_ADDONS_CHART_DIR}"
  "${PLATFORM_CHART_DIR}"
  "${PLATFORM_NOTIFICATIONS_CHART_DIR}"
  "${ISTIO_PLATFORM_CHART_DIR}"
)

helm_release_deployed() {
  local release="$1"
  local namespace="$2"
  local releases

  releases=$(helm list -n "${namespace}" --filter "^${release}$" --output json 2>/dev/null || true)
  [[ "${releases}" == *"\"status\":\"deployed\""* ]]
}

helm_release_has_changes() {
  local release="$1"
  local namespace="$2"
  local chart_ref="$3"
  local values_file="${4:-}"
  local chart_version="${5:-}"
  local current_manifest_file desired_manifest_file
  local same_manifest=false
  local -a template_cmd

  if ! helm_release_deployed "${release}" "${namespace}"; then
    return 0
  fi

  current_manifest_file="$(mktemp)"
  desired_manifest_file="$(mktemp)"
  if ! helm get manifest "${release}" -n "${namespace}" >"${current_manifest_file}" 2>/dev/null; then
    rm -f "${current_manifest_file}" "${desired_manifest_file}"
    return 0
  fi

  template_cmd=(helm template "${release}" "${chart_ref}" --namespace "${namespace}")
  if [ -n "${chart_version}" ]; then
    template_cmd+=(--version "${chart_version}")
  fi
  if [ -n "${values_file}" ]; then
    template_cmd+=(-f "${values_file}")
  fi
  "${template_cmd[@]}" >"${desired_manifest_file}"

  if cmp -s "${current_manifest_file}" "${desired_manifest_file}"; then
    same_manifest=true
  fi

  rm -f "${current_manifest_file}" "${desired_manifest_file}"
  if [ "${same_manifest}" = true ]; then
    return 1
  fi
  return 0
}

yaml_quote() {
  local value="${1:-}"
  value="${value//\\/\\\\}"
  value="${value//\"/\\\"}"
  printf '"%s"' "${value}"
}

chart_app_version_from_metadata() {
  local chart_dir="$1"
  awk '/^appVersion:/{gsub(/"/, "", $2); print $2; exit}' "${chart_dir}/Chart.yaml"
}

require_chart_version() {
  if [ -z "${CHART_VERSION:-}" ]; then
    echo "CHART_VERSION must be set to a SemVer chart version." >&2
    exit 1
  fi
}

platform_component_enabled() {
  local mode="$1"
  local component="$2"

  case "${mode}" in
    preflight)
      case "${component}" in
        provider|network) printf 'true\n' ;;
        *)                printf 'false\n' ;;
      esac
      ;;
    *)
      printf 'true\n'
      ;;
  esac
}

istio_platform_component_enabled() {
  local mode="$1"
  local component="$2"

  case "${mode}" in
    preflight)
      case "${component}" in
        controlPlaneEgress|wasmPlugins) printf 'false\n' ;;
        *)                               printf 'true\n' ;;
      esac
      ;;
    *)
      printf 'true\n'
      ;;
  esac
}

infra_addon_enabled() {
  local target="$1"
  shift || true

  [ "$#" -ne 0 ] || return 0
  local candidate
  for candidate in "$@"; do
    case "${candidate}" in
      all|"${target}") return 0 ;;
    esac
  done
  return 1
}

dev_image_infra_component_enabled() {
  local target="$1"
  shift || true

  [ "$#" -ne 0 ] || return 0
  local candidate
  for candidate in "$@"; do
    case "${candidate}" in
      all|"${target}") return 0 ;;
    esac
  done
  return 1
}

normalized_bool() {
  local value="${1:-}"
  case "$(printf '%s' "${value}" | tr '[:upper:]' '[:lower:]')" in
    1|true|yes|on) printf 'true\n' ;;
    *)             printf 'false\n' ;;
  esac
}

local_ingress_host() {
  local name="$1"
  local bind_ip="${LOCAL_INGRESS_BIND_IP:-}"

  if [ -n "${bind_ip}" ]; then
    printf '%s.%s.nip.io\n' "${name}" "${bind_ip}"
    return 0
  fi
  printf '%s.localhost\n' "${name}"
}

resolve_console_ingress_values() {
  local default_host default_ssl_redirect default_tls_enabled default_tls_secret
  local host ssl_redirect tls_enabled tls_secret scheme

  case "${CONSOLE_INGRESS_KUSTOMIZE_PATH}" in
    */console/overlays/local)
      default_host="$(local_ingress_host console)"
      default_ssl_redirect="false"
      default_tls_enabled="false"
      default_tls_secret=""
      ;;
    *)
      default_host="console.placeholder.invalid"
      default_ssl_redirect="true"
      default_tls_enabled="true"
      default_tls_secret="console-tls-placeholder"
      ;;
  esac

  host="${CONSOLE_INGRESS_HOST:-${default_host}}"
  ssl_redirect="$(normalized_bool "${CONSOLE_INGRESS_SSL_REDIRECT:-${default_ssl_redirect}}")"
  tls_enabled="$(normalized_bool "${CONSOLE_INGRESS_TLS_ENABLED:-${default_tls_enabled}}")"
  tls_secret="${CONSOLE_INGRESS_TLS_SECRET_NAME:-${default_tls_secret}}"
  if [ "${tls_enabled}" = "true" ] && [ -z "${tls_secret}" ]; then
    tls_secret="console-tls-placeholder"
  fi
  if [ "${tls_enabled}" = "true" ]; then
    scheme="https"
  else
    scheme="http"
  fi

  PLATFORM_CONSOLE_INGRESS_HOST="${host}"
  PLATFORM_CONSOLE_INGRESS_SSL_REDIRECT="${ssl_redirect}"
  PLATFORM_CONSOLE_INGRESS_TLS_ENABLED="${tls_enabled}"
  PLATFORM_CONSOLE_INGRESS_TLS_SECRET="${tls_secret}"
  PLATFORM_CONSOLE_BASE_URL="${scheme}://${host}"
  export PLATFORM_CONSOLE_INGRESS_HOST PLATFORM_CONSOLE_INGRESS_SSL_REDIRECT
  export PLATFORM_CONSOLE_INGRESS_TLS_ENABLED PLATFORM_CONSOLE_INGRESS_TLS_SECRET PLATFORM_CONSOLE_BASE_URL
}

write_console_ingress_extra_hosts() {
  local primary_host="$1"
  local extras_csv="${CONSOLE_INGRESS_EXTRA_HOSTS:-}"
  local -a extra_items=()
  local candidate trimmed seen line

  seen=""
  if [ "${primary_host}" != "console.localhost" ]; then
    seen=$'console.localhost'
  fi

  if [ -n "${extras_csv}" ]; then
    IFS=',' read -r -a extra_items <<<"${extras_csv}"
    for candidate in "${extra_items[@]}"; do
      trimmed="$(printf '%s' "${candidate}" | tr -d '[:space:]')"
      if [ -z "${trimmed}" ] || [ "${trimmed}" = "${primary_host}" ]; then
        continue
      fi
      if [ -n "${seen}" ] && printf '%s\n' "${seen}" | grep -Fxq "${trimmed}" 2>/dev/null; then
        continue
      fi
      seen="${seen}"$'\n'"${trimmed}"
    done
  fi

  if [ -z "${seen}" ]; then
    printf '    []\n'
    return 0
  fi

  while IFS= read -r line; do
    [ -n "${line}" ] || continue
    printf '    - %s\n' "$(yaml_quote "${line}")"
  done <<<"${seen}"
}

resolve_notification_ingress_values() {
  PLATFORM_NOTIFICATION_INGRESS_PRIMARY_HOST="${NOTIFICATION_INGRESS_PRIMARY_HOST:-notifications-primary.placeholder.invalid}"
  PLATFORM_NOTIFICATION_INGRESS_SECONDARY_HOST="${NOTIFICATION_INGRESS_SECONDARY_HOST:-notifications-secondary.placeholder.invalid}"
  PLATFORM_NOTIFICATION_INGRESS_TLS_SECRET="${NOTIFICATION_INGRESS_TLS_SECRET_NAME:-platform-notifications-tls-placeholder}"
  export PLATFORM_NOTIFICATION_INGRESS_PRIMARY_HOST PLATFORM_NOTIFICATION_INGRESS_SECONDARY_HOST PLATFORM_NOTIFICATION_INGRESS_TLS_SECRET
}

resolve_kiali_ingress_values() {
  local default_host default_path default_tls_enabled default_tls_secret tls_enabled

  case "${CONSOLE_INGRESS_KUSTOMIZE_PATH}" in
    */console/overlays/local)
      default_host="$(local_ingress_host kiali)"
      default_path="/"
      default_tls_enabled="false"
      default_tls_secret=""
      ;;
    *)
      default_host="kiali.placeholder.invalid"
      default_path="/"
      default_tls_enabled="true"
      default_tls_secret="kiali-tls-placeholder"
      ;;
  esac

  INFRA_KIALI_INGRESS_CLASS_NAME="${KIALI_INGRESS_CLASS_NAME:-nginx}"
  INFRA_KIALI_INGRESS_HOST="${KIALI_INGRESS_HOST:-${default_host}}"
  INFRA_KIALI_INGRESS_PATH="${KIALI_INGRESS_PATH:-${default_path}}"
  tls_enabled="$(normalized_bool "${KIALI_INGRESS_TLS_ENABLED:-${default_tls_enabled}}")"
  INFRA_KIALI_INGRESS_TLS_ENABLED="${tls_enabled}"
  INFRA_KIALI_INGRESS_TLS_SECRET_NAME="${KIALI_INGRESS_TLS_SECRET_NAME:-${default_tls_secret}}"
  if [ "${INFRA_KIALI_INGRESS_TLS_ENABLED}" = "true" ] && [ -z "${INFRA_KIALI_INGRESS_TLS_SECRET_NAME}" ]; then
    INFRA_KIALI_INGRESS_TLS_SECRET_NAME="kiali-tls-placeholder"
  fi

  export INFRA_KIALI_INGRESS_CLASS_NAME INFRA_KIALI_INGRESS_HOST INFRA_KIALI_INGRESS_PATH
  export INFRA_KIALI_INGRESS_TLS_ENABLED INFRA_KIALI_INGRESS_TLS_SECRET_NAME
}

resolve_grafana_ingress_values() {
  local default_host default_path default_tls_enabled default_tls_secret tls_enabled

  case "${CONSOLE_INGRESS_KUSTOMIZE_PATH}" in
    */console/overlays/local)
      default_host="$(local_ingress_host grafana)"
      default_path="/"
      default_tls_enabled="false"
      default_tls_secret=""
      ;;
    *)
      default_host="grafana.placeholder.invalid"
      default_path="/"
      default_tls_enabled="true"
      default_tls_secret="grafana-tls-placeholder"
      ;;
  esac

  INFRA_GRAFANA_INGRESS_CLASS_NAME="${GRAFANA_INGRESS_CLASS_NAME:-nginx}"
  INFRA_GRAFANA_INGRESS_HOST="${GRAFANA_INGRESS_HOST:-${default_host}}"
  INFRA_GRAFANA_INGRESS_PATH="${GRAFANA_INGRESS_PATH:-${default_path}}"
  tls_enabled="$(normalized_bool "${GRAFANA_INGRESS_TLS_ENABLED:-${default_tls_enabled}}")"
  INFRA_GRAFANA_INGRESS_TLS_ENABLED="${tls_enabled}"
  INFRA_GRAFANA_INGRESS_TLS_SECRET_NAME="${GRAFANA_INGRESS_TLS_SECRET_NAME:-${default_tls_secret}}"
  if [ "${INFRA_GRAFANA_INGRESS_TLS_ENABLED}" = "true" ] && [ -z "${INFRA_GRAFANA_INGRESS_TLS_SECRET_NAME}" ]; then
    INFRA_GRAFANA_INGRESS_TLS_SECRET_NAME="grafana-tls-placeholder"
  fi

  export INFRA_GRAFANA_INGRESS_CLASS_NAME INFRA_GRAFANA_INGRESS_HOST INFRA_GRAFANA_INGRESS_PATH
  export INFRA_GRAFANA_INGRESS_TLS_ENABLED INFRA_GRAFANA_INGRESS_TLS_SECRET_NAME
}

normalize_cidr() {
  local value="${1:-}"
  if [ -z "${value}" ]; then
    printf '\n'
    return 0
  fi
  case "${value}" in
    */*) printf '%s\n' "${value}" ;;
    *:*) printf '%s/128\n' "${value}" ;;
    *)   printf '%s/32\n' "${value}" ;;
  esac
}

url_host() {
  local value="${1:-}"
  value="${value#*://}"
  value="${value%%/*}"
  if [[ "${value}" == \[*\]* ]]; then
    value="${value#\[}"
    value="${value%%\]*}"
    printf '%s\n' "${value}"
    return 0
  fi
  if [[ "${value}" == *:* ]]; then
    printf '%s\n' "${value%%:*}"
    return 0
  fi
  printf '%s\n' "${value}"
}

resolve_platform_network_policy_cidrs() {
  local kubernetes_service_cidr="${PLATFORM_KUBERNETES_SERVICE_CIDR:-}"
  local api_server_cidr="${PLATFORM_API_SERVER_CIDR:-}"
  local kubernetes_service_ip api_server
  local placeholder_service_cidr="192.0.2.1/32"
  local placeholder_api_server_cidr="192.0.2.2/32"

  if [ -z "${kubernetes_service_cidr}" ] && command -v kubectl >/dev/null 2>&1; then
    kubernetes_service_ip="$(kubectl get service kubernetes -n default -o jsonpath='{.spec.clusterIP}' 2>/dev/null || true)"
    if [ -n "${kubernetes_service_ip}" ] && [ "${kubernetes_service_ip}" != "<no value>" ]; then
      kubernetes_service_cidr="$(normalize_cidr "${kubernetes_service_ip}")"
    fi
  fi
  if [ -z "${api_server_cidr}" ] && command -v kubectl >/dev/null 2>&1; then
    api_server="$(kubectl config view --minify -o jsonpath='{.clusters[0].cluster.server}' 2>/dev/null || true)"
    api_server="$(url_host "${api_server}")"
    if [ -n "${api_server}" ]; then
      api_server_cidr="$(normalize_cidr "${api_server}")"
    fi
  fi

  RESOLVED_PLATFORM_KUBERNETES_SERVICE_CIDR="${kubernetes_service_cidr:-${placeholder_service_cidr}}"
  RESOLVED_PLATFORM_API_SERVER_CIDR="${api_server_cidr:-${placeholder_api_server_cidr}}"

  if [ -z "${kubernetes_service_cidr}" ]; then
    log "PLATFORM_KUBERNETES_SERVICE_CIDR not set and auto-detection unavailable; using placeholder ${RESOLVED_PLATFORM_KUBERNETES_SERVICE_CIDR}"
  fi
  if [ -z "${api_server_cidr}" ]; then
    log "PLATFORM_API_SERVER_CIDR not set and auto-detection unavailable; using placeholder ${RESOLVED_PLATFORM_API_SERVER_CIDR}"
  fi

  export RESOLVED_PLATFORM_KUBERNETES_SERVICE_CIDR RESOLVED_PLATFORM_API_SERVER_CIDR
}

write_platform_notification_hosts() {
  resolve_notification_ingress_values
  printf '      - %s\n' "${PLATFORM_NOTIFICATION_INGRESS_PRIMARY_HOST}"
  if [ -n "${PLATFORM_NOTIFICATION_INGRESS_SECONDARY_HOST}" ]; then
    printf '      - %s\n' "${PLATFORM_NOTIFICATION_INGRESS_SECONDARY_HOST}"
  fi
}

write_cluster_bootstrap_values_file() {
  local file="$1"

  cat > "${file}" <<EOF
global:
  platformNamespace: $(yaml_quote "${NAMESPACE}")
  infraNamespace: $(yaml_quote "${INFRA_NAMESPACE}")
  observabilityNamespace: $(yaml_quote "${OBSERVABILITY_NAMESPACE}")
  networkNamespace: $(yaml_quote "${ISTIO_EGRESS_GATEWAY_NAMESPACE}")
  runNamespace: $(yaml_quote "${RUN_NAMESPACE}")
EOF
}

write_cluster_addons_values_file() {
  local file="$1"

  cat > "${file}" <<EOF
metricsServer:
  enabled: true
EOF
}

write_dev_image_infra_values_file() {
  local file="$1"
  shift || true

  local addon_targets=("$@")
  local registry_enabled=false
  local cache_enabled=false

  [ "${#addon_targets[@]}" -ne 0 ] || addon_targets=(all)
  if dev_image_infra_component_enabled registry "${addon_targets[@]}"; then registry_enabled=true; fi
  if dev_image_infra_component_enabled cache "${addon_targets[@]}"; then cache_enabled=true; fi

  cat > "${file}" <<EOF
global:
  partOf: code-code
  infraNamespace: $(yaml_quote "${INFRA_NAMESPACE}")
registry:
  enabled: ${registry_enabled}
  image: $(yaml_quote "${DEV_IMAGE_INFRA_REGISTRY_IMAGE}")
  service:
    type: $(yaml_quote "${DEV_IMAGE_INFRA_REGISTRY_SERVICE_TYPE}")
    nodePort: ${DEV_IMAGE_INFRA_REGISTRY_NODE_PORT}
cache:
  enabled: ${cache_enabled}
  image: $(yaml_quote "${DEV_IMAGE_INFRA_CACHE_IMAGE}")
  service:
    type: $(yaml_quote "${DEV_IMAGE_INFRA_CACHE_SERVICE_TYPE}")
  mirrors:
    dockerIo:
      nodePort: ${DEV_IMAGE_INFRA_CACHE_DOCKER_IO_NODE_PORT}
    registryK8sIo:
      nodePort: ${DEV_IMAGE_INFRA_CACHE_REGISTRY_K8S_IO_NODE_PORT}
    quayIo:
      nodePort: ${DEV_IMAGE_INFRA_CACHE_QUAY_IO_NODE_PORT}
EOF
}

write_infrastructure_core_values_file() {
  local file="$1"
  local tempo_enabled="${2:-false}"

  cat > "${file}" <<EOF
global:
  platformNamespace: $(yaml_quote "${NAMESPACE}")
  infraNamespace: $(yaml_quote "${INFRA_NAMESPACE}")
  observabilityNamespace: $(yaml_quote "${OBSERVABILITY_NAMESPACE}")
  networkNamespace: $(yaml_quote "${ISTIO_EGRESS_GATEWAY_NAMESPACE}")
  runNamespace: $(yaml_quote "${RUN_NAMESPACE}")
alertmanager:
  wechat:
    corpId: $(yaml_quote "${ALERTMANAGER_WECHAT_API_CORP_ID}")
    agentId: $(yaml_quote "${ALERTMANAGER_WECHAT_AGENT_ID}")
    partyId: $(yaml_quote "${ALERTMANAGER_WECHAT_PARTY_ID}")
otelCollector:
  tempoEnabled: ${tempo_enabled}
  tempoEndpoint: $(yaml_quote "tempo.${OBSERVABILITY_NAMESPACE}.svc.cluster.local:4317")
EOF
}

write_infrastructure_addons_values_file() {
  local file="$1"
  shift || true

  local grafana_enabled=false
  local tempo_enabled=false
  local loki_enabled=false
  local alloy_enabled=false
  local kiali_enabled=false
  local cloudflare_enabled=false
  local default_grafana_org_role default_grafana_viewers_can_edit
  local grafana_anonymous_org_role grafana_viewers_can_edit grafana_explore_enabled

  if infra_addon_enabled grafana "$@"; then grafana_enabled=true; fi
  if infra_addon_enabled tempo "$@"; then tempo_enabled=true; fi
  if infra_addon_enabled loki "$@"; then loki_enabled=true; fi
  if infra_addon_enabled alloy "$@"; then alloy_enabled=true; fi
  if infra_addon_enabled kiali "$@"; then kiali_enabled=true; fi
  if infra_addon_enabled cloudflare-ddns "$@"; then cloudflare_enabled=true; fi
  resolve_grafana_ingress_values
  resolve_kiali_ingress_values
  case "${CONSOLE_INGRESS_KUSTOMIZE_PATH}" in
    */console/overlays/local)
      default_grafana_org_role="Editor"
      default_grafana_viewers_can_edit="true"
      ;;
    *)
      default_grafana_org_role="Viewer"
      default_grafana_viewers_can_edit="false"
      ;;
  esac
  grafana_anonymous_org_role="${GRAFANA_ANONYMOUS_ORG_ROLE:-${default_grafana_org_role}}"
  grafana_viewers_can_edit="$(normalized_bool "${GRAFANA_VIEWERS_CAN_EDIT:-${default_grafana_viewers_can_edit}}")"
  grafana_explore_enabled="$(normalized_bool "${GRAFANA_EXPLORE_ENABLED:-true}")"

  cat > "${file}" <<EOF
global:
  platformNamespace: $(yaml_quote "${NAMESPACE}")
  infraNamespace: $(yaml_quote "${INFRA_NAMESPACE}")
  observabilityNamespace: $(yaml_quote "${OBSERVABILITY_NAMESPACE}")
  networkNamespace: $(yaml_quote "${ISTIO_EGRESS_GATEWAY_NAMESPACE}")
  runNamespace: $(yaml_quote "${RUN_NAMESPACE}")
grafana:
  enabled: ${grafana_enabled}
  anonymousOrgRole: $(yaml_quote "${grafana_anonymous_org_role}")
  viewersCanEdit: ${grafana_viewers_can_edit}
  exploreEnabled: ${grafana_explore_enabled}
  ingress:
    enabled: ${grafana_enabled}
    className: $(yaml_quote "${INFRA_GRAFANA_INGRESS_CLASS_NAME}")
    host: $(yaml_quote "${INFRA_GRAFANA_INGRESS_HOST}")
    path: $(yaml_quote "${INFRA_GRAFANA_INGRESS_PATH}")
    tlsEnabled: ${INFRA_GRAFANA_INGRESS_TLS_ENABLED}
    tlsSecretName: $(yaml_quote "${INFRA_GRAFANA_INGRESS_TLS_SECRET_NAME}")
tempo:
  enabled: ${tempo_enabled}
loki:
  enabled: ${loki_enabled}
alloy:
  enabled: ${alloy_enabled}
  clusterName: $(yaml_quote "${ALLOY_CLUSTER_NAME}")
  lokiWriteUrl: $(yaml_quote "${ALLOY_LOKI_WRITE_URL}")
cloudflareDdns:
  enabled: ${cloudflare_enabled}
  domains: $(yaml_quote "${CLOUDFLARE_DDNS_DOMAINS}")
  proxied: $(yaml_quote "${CLOUDFLARE_DDNS_PROXIED}")
  ip4Provider: $(yaml_quote "${CLOUDFLARE_DDNS_IP4_PROVIDER}")
  ip6Provider: $(yaml_quote "${CLOUDFLARE_DDNS_IP6_PROVIDER}")
  updateCron: $(yaml_quote "${CLOUDFLARE_DDNS_UPDATE_CRON}")
  updateOnStart: $(yaml_quote "${CLOUDFLARE_DDNS_UPDATE_ON_START}")
kiali:
  enabled: ${kiali_enabled}
  ingress:
    enabled: ${kiali_enabled}
    className: $(yaml_quote "${INFRA_KIALI_INGRESS_CLASS_NAME}")
    host: $(yaml_quote "${INFRA_KIALI_INGRESS_HOST}")
    path: $(yaml_quote "${INFRA_KIALI_INGRESS_PATH}")
    tlsEnabled: ${INFRA_KIALI_INGRESS_TLS_ENABLED}
    tlsSecretName: $(yaml_quote "${INFRA_KIALI_INGRESS_TLS_SECRET_NAME}")
EOF
}

write_platform_values_file() {
  local file="$1"
  local mode="${2:-full}"
  local image_registry="${IMAGE_REGISTRY%/}"

  resolve_console_ingress_values
  resolve_platform_network_policy_cidrs

  cat > "${file}" <<EOF
global:
  imageRegistry: $(yaml_quote "${image_registry}")
  imageTag: $(yaml_quote "${IMAGE_TAG}")
  runNamespace: $(yaml_quote "${RUN_NAMESPACE}")
  infraNamespace: $(yaml_quote "${INFRA_NAMESPACE}")
  observabilityNamespace: $(yaml_quote "${OBSERVABILITY_NAMESPACE}")
  egressGatewayNamespace: $(yaml_quote "${ISTIO_EGRESS_GATEWAY_NAMESPACE}")
  egressGatewayServiceHost: $(yaml_quote "${ISTIO_EGRESS_GATEWAY_RELEASE}.${ISTIO_EGRESS_GATEWAY_NAMESPACE}.svc.cluster.local")
  egressGatewaySelector: $(yaml_quote "${ISTIO_EGRESS_GATEWAY_RELEASE}")
  consoleBaseUrl: $(yaml_quote "${PLATFORM_CONSOLE_BASE_URL}")
cliImageBuildConfig:
  enabled: true
  imageRegistryPrefix: $(yaml_quote "${CLI_RUNTIME_IMAGE_REGISTRY_PREFIX}")
  imageRegistryLookupPrefix: $(yaml_quote "${CLI_RUNTIME_IMAGE_REGISTRY_LOOKUP_PREFIX}")
  imageRegistryLookupInsecure: $(yaml_quote "${CLI_RUNTIME_IMAGE_REGISTRY_LOOKUP_INSECURE}")
  sourceContext: $(yaml_quote "${CLI_RUNTIME_IMAGE_BUILD_SOURCE_CONTEXT}")
  sourceRevision: $(yaml_quote "${CLI_RUNTIME_IMAGE_BUILD_SOURCE_REVISION}")
consoleIngress:
  enabled: $( [ "${mode}" = "preflight" ] && printf 'false' || printf 'true' )
  host: $(yaml_quote "${PLATFORM_CONSOLE_INGRESS_HOST}")
  extraHosts:
$(write_console_ingress_extra_hosts "${PLATFORM_CONSOLE_INGRESS_HOST}")
  tlsEnabled: ${PLATFORM_CONSOLE_INGRESS_TLS_ENABLED}
  tlsSecretName: $(yaml_quote "${PLATFORM_CONSOLE_INGRESS_TLS_SECRET}")
  sslRedirect: ${PLATFORM_CONSOLE_INGRESS_SSL_REDIRECT}
networkEgressPolicy:
  presetProxyUrl: $(yaml_quote "${PLATFORM_EGRESS_PRESET_PROXY_URL}")
components:
  auth:
    enabled: $(platform_component_enabled "${mode}" auth)
  model:
    enabled: $(platform_component_enabled "${mode}" model)
  provider:
    enabled: $(platform_component_enabled "${mode}" provider)
  network:
    enabled: $(platform_component_enabled "${mode}" network)
  profile:
    enabled: $(platform_component_enabled "${mode}" profile)
  support:
    enabled: $(platform_component_enabled "${mode}" support)
  cliRuntime:
    enabled: $(platform_component_enabled "${mode}" cliRuntime)
  agentRuntime:
    enabled: $(platform_component_enabled "${mode}" agentRuntime)
    runtimeRbac:
      networkPolicies:
        agentRunEgress:
          spec:
            egress:
              - ports:
                  - protocol: UDP
                    port: 53
                  - protocol: TCP
                    port: 53
              - to:
                  - ipBlock:
                      cidr: $(yaml_quote "${RESOLVED_PLATFORM_KUBERNETES_SERVICE_CIDR}")
                ports:
                  - protocol: TCP
                    port: 443
              - to:
                  - ipBlock:
                      cidr: $(yaml_quote "${RESOLVED_PLATFORM_API_SERVER_CIDR}")
                ports:
                  - protocol: TCP
                    port: 6443
              - to:
                  - namespaceSelector:
                      matchLabels:
                        kubernetes.io/metadata.name: $(yaml_quote "${ISTIO_EGRESS_GATEWAY_NAMESPACE}")
                ports:
                  - protocol: TCP
                    port: 443
              - to:
                  - namespaceSelector:
                      matchLabels:
                        kubernetes.io/metadata.name: $(yaml_quote "${NAMESPACE}")
                    podSelector:
                      matchLabels:
                        app.kubernetes.io/name: platform-agent-runtime-service
                ports:
                  - protocol: TCP
                    port: 8080
                  - protocol: TCP
                    port: 8081
              - to:
                  - namespaceSelector:
                      matchLabels:
                        kubernetes.io/metadata.name: $(yaml_quote "${INFRA_NAMESPACE}")
                    podSelector:
                      matchLabels:
                        app.kubernetes.io/name: nats
                ports:
                  - protocol: TCP
                    port: 4222
              - to:
                  - namespaceSelector:
                      matchLabels:
                        kubernetes.io/metadata.name: $(yaml_quote "${INFRA_NAMESPACE}")
                    podSelector:
                      matchLabels:
                        app.kubernetes.io/name: otel-collector
                ports:
                  - protocol: TCP
                    port: 4318
  chat:
    enabled: $(platform_component_enabled "${mode}" chat)
  consoleApi:
    enabled: $(platform_component_enabled "${mode}" consoleApi)
  consoleWeb:
    enabled: $(platform_component_enabled "${mode}" consoleWeb)
EOF
}

write_platform_notifications_values_file() {
  local file="$1"
  local image_registry="${IMAGE_REGISTRY%/}"

  resolve_notification_ingress_values

  cat > "${file}" <<EOF
global:
  imageRegistry: $(yaml_quote "${image_registry}")
  imageTag: $(yaml_quote "${IMAGE_TAG}")
  infraNamespace: $(yaml_quote "${INFRA_NAMESPACE}")
notificationDispatcher:
  enabled: true
  natsUrl: $(yaml_quote "nats://nats.${INFRA_NAMESPACE}.svc.cluster.local:4222")
  ingress:
    enabled: true
    tlsSecretName: $(yaml_quote "${PLATFORM_NOTIFICATION_INGRESS_TLS_SECRET}")
    hosts:
$(write_platform_notification_hosts)
EOF
}

write_istio_platform_values_file() {
  local file="$1"
  local mode="${2:-full}"
  local wasm_registry="${WASM_IMAGE_REGISTRY%/}"
  local telemetry_enabled

  telemetry_enabled="$(istio_platform_component_enabled "${mode}" telemetry)"
  if [ "${telemetry_enabled}" = "true" ]; then
    telemetry_enabled="$(normalized_bool "${ISTIO_PLATFORM_TELEMETRY_ENABLED:-false}")"
  fi
  cat > "${file}" <<EOF
global:
  imageRegistry: $(yaml_quote "${wasm_registry}")
  imageTag: $(yaml_quote "${IMAGE_TAG}")
  platformNamespace: $(yaml_quote "${NAMESPACE}")
  runNamespace: $(yaml_quote "${RUN_NAMESPACE}")
  infraNamespace: $(yaml_quote "${INFRA_NAMESPACE}")
  observabilityNamespace: $(yaml_quote "${OBSERVABILITY_NAMESPACE}")
  istioNamespace: $(yaml_quote "${ISTIO_NAMESPACE}")
  certManagerNamespace: $(yaml_quote "${CERT_MANAGER_NAMESPACE}")
  egressNamespace: $(yaml_quote "${ISTIO_EGRESS_GATEWAY_NAMESPACE}")
  egressGatewaySelector: $(yaml_quote "${ISTIO_EGRESS_GATEWAY_RELEASE}")
components:
  egressCertificates:
    enabled: $(istio_platform_component_enabled "${mode}" egressCertificates)
  waypoints:
    enabled: $(istio_platform_component_enabled "${mode}" waypoints)
  telemetry:
    enabled: ${telemetry_enabled}
  controlPlaneEgress:
    enabled: $(istio_platform_component_enabled "${mode}" controlPlaneEgress)
  wasmPlugins:
    enabled: $(istio_platform_component_enabled "${mode}" wasmPlugins)
EOF
}

write_temporal_values_file() {
  local file="$1"

  cat > "${file}" <<EOF
server:
  replicaCount: 1
  securityContext:
    fsGroup: 1000
    runAsNonRoot: true
    runAsUser: 1000
    seccompProfile:
      type: RuntimeDefault
  config:
    logLevel: "info"
    persistence:
      defaultStore: default
      visibilityStore: visibility
      numHistoryShards: 4
      datastores:
        default:
          sql:
            createDatabase: true
            manageSchema: true
            pluginName: postgres12_pgx
            driverName: postgres12_pgx
            databaseName: temporal
            connectAddr: $(yaml_quote "postgres.${INFRA_NAMESPACE}.svc.cluster.local:5432")
            connectProtocol: tcp
            user: code_code
            existingSecret: postgres-auth
            secretKey: POSTGRES_PASSWORD
            maxConns: 10
            maxIdleConns: 10
        visibility:
          sql:
            createDatabase: true
            manageSchema: true
            pluginName: postgres12_pgx
            driverName: postgres12_pgx
            databaseName: temporal_visibility
            connectAddr: $(yaml_quote "postgres.${INFRA_NAMESPACE}.svc.cluster.local:5432")
            connectProtocol: tcp
            user: code_code
            existingSecret: postgres-auth
            secretKey: POSTGRES_PASSWORD
            maxConns: 5
            maxIdleConns: 5
  resources:
    requests:
      cpu: 25m
      memory: 96Mi
    limits:
      cpu: 500m
      memory: 512Mi
  frontend:
    readinessProbe:
      grpc:
        port: 7233
        service: temporal.api.workflowservice.v1.WorkflowService
      timeoutSeconds: 5
      periodSeconds: 10
      failureThreshold: 6
    resources:
      requests:
        cpu: 100m
        memory: 128Mi
      limits:
        cpu: 500m
        memory: 512Mi
    containerSecurityContext: &temporalRestrictedContainerSecurityContext
      allowPrivilegeEscalation: false
      capabilities:
        drop:
          - ALL
  history:
    resources:
      requests:
        cpu: 100m
        memory: 256Mi
      limits:
        cpu: 750m
        memory: 768Mi
    containerSecurityContext: *temporalRestrictedContainerSecurityContext
  matching:
    resources:
      requests:
        cpu: 100m
        memory: 128Mi
      limits:
        cpu: 500m
        memory: 512Mi
    containerSecurityContext: *temporalRestrictedContainerSecurityContext
  worker:
    resources:
      requests:
        cpu: 25m
        memory: 96Mi
      limits:
        cpu: 500m
        memory: 512Mi
    containerSecurityContext: *temporalRestrictedContainerSecurityContext

admintools:
  enabled: false

web:
  enabled: false

schema:
  resources:
    requests:
      cpu: 25m
      memory: 64Mi
    limits:
      cpu: 500m
      memory: 512Mi
  containerSecurityContext: *temporalRestrictedContainerSecurityContext
  securityContext:
    fsGroup: 1000
    runAsNonRoot: true
    runAsUser: 1000
    seccompProfile:
      type: RuntimeDefault

test:
  resources:
    requests:
      cpu: 25m
      memory: 64Mi
    limits:
      cpu: 250m
      memory: 256Mi

shims:
  dockerize: false
  elasticsearchTool: false
EOF
}

write_kiali_operator_values_file() {
  local file="$1"

  cat > "${file}" <<EOF
image:
  pullPolicy: IfNotPresent
debug:
  enabled: true
  verbosity: "1"
watchNamespace: ""
clusterRoleCreator: true
allowAdHocKialiNamespace: true
allowAdHocKialiImage: false
allowAdHocContainers: false
allowSecurityContextOverride: false
allowAllAccessibleNamespaces: true
cr:
  create: false
EOF
}

deploy_cluster_bootstrap_chart() {
  local values_file

  require_cmd helm
  values_file="$(mktemp "${TMP_RELEASE_DIR}/cluster-bootstrap-values.XXXX.yaml")"
  write_cluster_bootstrap_values_file "${values_file}"

  if ! helm_release_has_changes "${CLUSTER_BOOTSTRAP_HELM_RELEASE}" "${NAMESPACE}" "${CLUSTER_BOOTSTRAP_CHART_DIR}" "${values_file}"; then
    log "Skipping cluster-bootstrap chart (no manifest changes)"
    return 0
  fi

  log "Deploying cluster-bootstrap chart"
  helm upgrade --install "${CLUSTER_BOOTSTRAP_HELM_RELEASE}" "${CLUSTER_BOOTSTRAP_CHART_DIR}" \
    --namespace "${NAMESPACE}" \
    --create-namespace \
    --take-ownership \
    --history-max "${HELM_HISTORY_MAX}" \
    -f "${values_file}"
}

deploy_cluster_addons_chart() {
  local values_file

  require_cmd helm
  values_file="$(mktemp "${TMP_RELEASE_DIR}/cluster-addons-values.XXXX.yaml")"
  write_cluster_addons_values_file "${values_file}"

  if ! helm_release_has_changes "${CLUSTER_ADDONS_HELM_RELEASE}" "${NAMESPACE}" "${CLUSTER_ADDONS_CHART_DIR}" "${values_file}"; then
    log "Skipping cluster-addons chart (no manifest changes)"
    return 0
  fi

  log "Deploying cluster-addons chart"
  helm upgrade --install "${CLUSTER_ADDONS_HELM_RELEASE}" "${CLUSTER_ADDONS_CHART_DIR}" \
    --namespace "${NAMESPACE}" \
    --create-namespace \
    --take-ownership \
    --history-max "${HELM_HISTORY_MAX}" \
    -f "${values_file}"
}

deploy_dev_image_infra_chart() {
  local values_file

  require_cmd helm
  values_file="$(mktemp "${TMP_RELEASE_DIR}/dev-image-infra-values.XXXX.yaml")"
  write_dev_image_infra_values_file "${values_file}" "$@"

  if ! helm_release_has_changes "${DEV_IMAGE_INFRA_HELM_RELEASE}" "${INFRA_NAMESPACE}" "${DEV_IMAGE_INFRA_CHART_DIR}" "${values_file}"; then
    log "Skipping dev-image-infra chart (no manifest changes)"
    return 0
  fi

  log "Deploying dev-image-infra chart"
  helm upgrade --install "${DEV_IMAGE_INFRA_HELM_RELEASE}" "${DEV_IMAGE_INFRA_CHART_DIR}" \
    --namespace "${INFRA_NAMESPACE}" \
    --create-namespace \
    --take-ownership \
    --history-max "${HELM_HISTORY_MAX}" \
    -f "${values_file}"
}

deploy_infrastructure_core_chart() {
  local tempo_enabled="${1:-false}"
  local values_file

  require_cmd helm
  values_file="$(mktemp "${TMP_RELEASE_DIR}/infrastructure-core-values.XXXX.yaml")"
  write_infrastructure_core_values_file "${values_file}" "${tempo_enabled}"

  if ! helm_release_has_changes "${INFRASTRUCTURE_CORE_HELM_RELEASE}" "${NAMESPACE}" "${INFRASTRUCTURE_CORE_CHART_DIR}" "${values_file}"; then
    log "Skipping infrastructure-core chart (no manifest changes)"
    return 0
  fi

  log "Deploying infrastructure-core chart (tempoEnabled=${tempo_enabled})"
  helm upgrade --install "${INFRASTRUCTURE_CORE_HELM_RELEASE}" "${INFRASTRUCTURE_CORE_CHART_DIR}" \
    --namespace "${NAMESPACE}" \
    --create-namespace \
    --take-ownership \
    --history-max "${HELM_HISTORY_MAX}" \
    -f "${values_file}"
}

deploy_infrastructure_addons_chart() {
  local values_file

  require_cmd helm
  values_file="$(mktemp "${TMP_RELEASE_DIR}/infrastructure-addons-values.XXXX.yaml")"
  write_infrastructure_addons_values_file "${values_file}" "$@"

  if ! helm_release_has_changes "${INFRASTRUCTURE_ADDONS_HELM_RELEASE}" "${NAMESPACE}" "${INFRASTRUCTURE_ADDONS_CHART_DIR}" "${values_file}"; then
    log "Skipping infrastructure-addons chart (no manifest changes)"
    return 0
  fi

  log "Deploying infrastructure-addons chart"
  helm upgrade --install "${INFRASTRUCTURE_ADDONS_HELM_RELEASE}" "${INFRASTRUCTURE_ADDONS_CHART_DIR}" \
    --namespace "${NAMESPACE}" \
    --create-namespace \
    --take-ownership \
    --history-max "${HELM_HISTORY_MAX}" \
    -f "${values_file}"
}

deploy_platform_chart() {
  local mode="${1:-full}"
  local values_file

  require_cmd helm
  values_file="$(mktemp "${TMP_RELEASE_DIR}/platform-values.${mode}.XXXX.yaml")"
  write_platform_values_file "${values_file}" "${mode}"

  if ! helm_release_has_changes "${PLATFORM_HELM_RELEASE}" "${NAMESPACE}" "${PLATFORM_CHART_DIR}" "${values_file}"; then
    log "Skipping platform chart (${mode}) (no manifest changes)"
    return 0
  fi

  log "Deploying platform chart (${mode})"
  helm upgrade --install "${PLATFORM_HELM_RELEASE}" "${PLATFORM_CHART_DIR}" \
    --namespace "${NAMESPACE}" \
    --create-namespace \
    --take-ownership \
    --history-max "${HELM_HISTORY_MAX}" \
    -f "${values_file}"
}

deploy_platform_notifications_chart() {
  local values_file

  require_cmd helm
  values_file="$(mktemp "${TMP_RELEASE_DIR}/platform-notifications-values.XXXX.yaml")"
  write_platform_notifications_values_file "${values_file}"

  if ! helm_release_has_changes "${PLATFORM_NOTIFICATIONS_HELM_RELEASE}" "${NAMESPACE}" "${PLATFORM_NOTIFICATIONS_CHART_DIR}" "${values_file}"; then
    log "Skipping platform-notifications chart (no manifest changes)"
    return 0
  fi

  log "Deploying platform-notifications chart"
  helm upgrade --install "${PLATFORM_NOTIFICATIONS_HELM_RELEASE}" "${PLATFORM_NOTIFICATIONS_CHART_DIR}" \
    --namespace "${NAMESPACE}" \
    --create-namespace \
    --take-ownership \
    --history-max "${HELM_HISTORY_MAX}" \
    -f "${values_file}"
}

deploy_istio_platform_chart() {
  local mode="${1:-full}"
  local values_file

  require_cmd helm
  values_file="$(mktemp "${TMP_RELEASE_DIR}/istio-platform-values.${mode}.XXXX.yaml")"
  write_istio_platform_values_file "${values_file}" "${mode}"

  if ! helm_release_has_changes "${ISTIO_PLATFORM_HELM_RELEASE}" "${ISTIO_NAMESPACE}" "${ISTIO_PLATFORM_CHART_DIR}" "${values_file}"; then
    log "Skipping istio-platform chart (${mode}) (no manifest changes)"
    return 0
  fi

  log "Deploying istio-platform chart (${mode})"
  helm upgrade --install "${ISTIO_PLATFORM_HELM_RELEASE}" "${ISTIO_PLATFORM_CHART_DIR}" \
    --namespace "${ISTIO_NAMESPACE}" \
    --create-namespace \
    --take-ownership \
    --history-max "${HELM_HISTORY_MAX}" \
    -f "${values_file}"
}

chart_package_app_version() {
  local chart_dir="$1"
  local chart_name

  chart_name="$(basename "${chart_dir}")"
  case "${chart_name}" in
    platform|platform-notifications|istio-platform)
      printf '%s' "${CHART_APP_VERSION:-${IMAGE_TAG}}"
      ;;
    infrastructure-core|infrastructure-addons)
      if [ -n "${CHART_APP_VERSION:-}" ]; then
        printf '%s' "${CHART_APP_VERSION}"
      else
        printf '%s' "${CHART_VERSION}"
      fi
      ;;
    *)
      if [ -n "${CHART_APP_VERSION:-}" ]; then
        printf '%s' "${CHART_APP_VERSION}"
      else
        chart_app_version_from_metadata "${chart_dir}"
      fi
      ;;
  esac
}

package_chart_artifact() {
  local chart_dir="$1"
  local output_dir="$2"
  local version="$3"
  local app_version

  app_version="$(chart_package_app_version "${chart_dir}")"
  helm package "${chart_dir}" \
    --destination "${output_dir}" \
    --version "${version}" \
    --app-version "${app_version}" >/dev/null
}

prepare_package_dir() {
  local output_dir="$1"

  mkdir -p "${output_dir}"
  rm -f "${output_dir}"/cluster-bootstrap-*.tgz
  rm -f "${output_dir}"/cluster-addons-*.tgz
  rm -f "${output_dir}"/dev-image-infra-*.tgz
  rm -f "${output_dir}"/infrastructure-core-*.tgz
  rm -f "${output_dir}"/infrastructure-addons-*.tgz
  rm -f "${output_dir}"/platform-*.tgz
  rm -f "${output_dir}"/platform-notifications-*.tgz
  rm -f "${output_dir}"/istio-platform-*.tgz
}

package_charts() {
  local chart_dir

  require_cmd helm
  require_chart_version
  prepare_package_dir "${CHART_PACKAGE_DIR}"
  for chart_dir in "${LOCAL_CHART_DIRS[@]}"; do
    log "Packaging chart $(basename "${chart_dir}")"
    package_chart_artifact "${chart_dir}" "${CHART_PACKAGE_DIR}" "${CHART_VERSION}"
  done
}

push_charts() {
  local chart_dir chart_name archive

  require_cmd helm
  require_chart_version
  if [ -z "${CHART_OCI_REGISTRY:-}" ]; then
    echo "CHART_OCI_REGISTRY must be set to an OCI repository prefix, for example oci://ghcr.io/org/charts." >&2
    exit 1
  fi

  package_charts
  for chart_dir in "${LOCAL_CHART_DIRS[@]}"; do
    chart_name="$(basename "${chart_dir}")"
    archive="${CHART_PACKAGE_DIR}/${chart_name}-${CHART_VERSION}.tgz"
    log "Pushing chart ${chart_name}"
    helm push "${archive}" "${CHART_OCI_REGISTRY}" >/dev/null
  done
}

validate_charts() {
  local cluster_bootstrap_values cluster_addons_values dev_image_infra_values
  local infra_core_values infra_core_tracing_values infra_addons_values
  local platform_full_values platform_preflight_values platform_notifications_values
  local istio_full_values istio_preflight_values
  local temporal_values kiali_operator_values validate_pkg_dir chart_dir

  require_cmd helm
  configure_console_ingress_defaults
  configure_wasm_registry_defaults

  cluster_bootstrap_values="$(mktemp "${TMP_RELEASE_DIR}/cluster-bootstrap-values.XXXX.yaml")"
  cluster_addons_values="$(mktemp "${TMP_RELEASE_DIR}/cluster-addons-values.XXXX.yaml")"
  dev_image_infra_values="$(mktemp "${TMP_RELEASE_DIR}/dev-image-infra-values.XXXX.yaml")"
  infra_core_values="$(mktemp "${TMP_RELEASE_DIR}/infrastructure-core-values.XXXX.yaml")"
  infra_core_tracing_values="$(mktemp "${TMP_RELEASE_DIR}/infrastructure-core-values.tracing.XXXX.yaml")"
  infra_addons_values="$(mktemp "${TMP_RELEASE_DIR}/infrastructure-addons-values.XXXX.yaml")"
  platform_full_values="$(mktemp "${TMP_RELEASE_DIR}/platform-values.full.XXXX.yaml")"
  platform_preflight_values="$(mktemp "${TMP_RELEASE_DIR}/platform-values.preflight.XXXX.yaml")"
  platform_notifications_values="$(mktemp "${TMP_RELEASE_DIR}/platform-notifications-values.XXXX.yaml")"
  istio_full_values="$(mktemp "${TMP_RELEASE_DIR}/istio-platform-values.full.XXXX.yaml")"
  istio_preflight_values="$(mktemp "${TMP_RELEASE_DIR}/istio-platform-values.preflight.XXXX.yaml")"
  temporal_values="$(mktemp "${TMP_RELEASE_DIR}/temporal-values.XXXX.yaml")"
  kiali_operator_values="$(mktemp "${TMP_RELEASE_DIR}/kiali-operator-values.XXXX.yaml")"
  validate_pkg_dir="$(mktemp -d "${TMP_RELEASE_DIR}/chart-packages.XXXXXX")"

  write_cluster_bootstrap_values_file "${cluster_bootstrap_values}"
  write_cluster_addons_values_file "${cluster_addons_values}"
  write_dev_image_infra_values_file "${dev_image_infra_values}" all
  write_infrastructure_core_values_file "${infra_core_values}" false
  write_infrastructure_core_values_file "${infra_core_tracing_values}" true
  write_infrastructure_addons_values_file "${infra_addons_values}" all
  write_platform_values_file "${platform_full_values}" full
  write_platform_values_file "${platform_preflight_values}" preflight
  write_platform_notifications_values_file "${platform_notifications_values}"
  write_istio_platform_values_file "${istio_full_values}" full
  write_istio_platform_values_file "${istio_preflight_values}" preflight
  write_temporal_values_file "${temporal_values}"
  write_kiali_operator_values_file "${kiali_operator_values}"

  for chart_dir in "${LOCAL_CHART_DIRS[@]}"; do
    helm lint "${chart_dir}"
  done

  helm template "${CLUSTER_BOOTSTRAP_HELM_RELEASE}" "${CLUSTER_BOOTSTRAP_CHART_DIR}" -f "${cluster_bootstrap_values}" >/dev/null
  helm template "${CLUSTER_BOOTSTRAP_HELM_RELEASE}" "${CLUSTER_BOOTSTRAP_CHART_DIR}" -f "${CLUSTER_BOOTSTRAP_CHART_DIR}/examples/local.yaml" >/dev/null
  helm template "${CLUSTER_ADDONS_HELM_RELEASE}" "${CLUSTER_ADDONS_CHART_DIR}" -f "${cluster_addons_values}" >/dev/null
  helm template "${CLUSTER_ADDONS_HELM_RELEASE}" "${CLUSTER_ADDONS_CHART_DIR}" -f "${CLUSTER_ADDONS_CHART_DIR}/examples/metrics-server.yaml" >/dev/null
  helm template "${DEV_IMAGE_INFRA_HELM_RELEASE}" "${DEV_IMAGE_INFRA_CHART_DIR}" -f "${dev_image_infra_values}" >/dev/null
  helm template "${DEV_IMAGE_INFRA_HELM_RELEASE}" "${DEV_IMAGE_INFRA_CHART_DIR}" -f "${DEV_IMAGE_INFRA_CHART_DIR}/examples/colima-k3s.yaml" >/dev/null
  helm template "${INFRASTRUCTURE_CORE_HELM_RELEASE}" "${INFRASTRUCTURE_CORE_CHART_DIR}" -f "${infra_core_values}" >/dev/null
  helm template "${INFRASTRUCTURE_CORE_HELM_RELEASE}" "${INFRASTRUCTURE_CORE_CHART_DIR}" -f "${infra_core_tracing_values}" >/dev/null
  helm template "${INFRASTRUCTURE_CORE_HELM_RELEASE}" "${INFRASTRUCTURE_CORE_CHART_DIR}" -f "${INFRASTRUCTURE_CORE_CHART_DIR}/examples/baseline.yaml" >/dev/null
  helm template "${INFRASTRUCTURE_ADDONS_HELM_RELEASE}" "${INFRASTRUCTURE_ADDONS_CHART_DIR}" -f "${infra_addons_values}" >/dev/null
  helm template "${INFRASTRUCTURE_ADDONS_HELM_RELEASE}" "${INFRASTRUCTURE_ADDONS_CHART_DIR}" -f "${INFRASTRUCTURE_ADDONS_CHART_DIR}/examples/observability.yaml" >/dev/null
  helm template "${PLATFORM_HELM_RELEASE}" "${PLATFORM_CHART_DIR}" -f "${platform_full_values}" >/dev/null
  helm template "${PLATFORM_HELM_RELEASE}" "${PLATFORM_CHART_DIR}" -f "${platform_preflight_values}" >/dev/null
  helm template "${PLATFORM_HELM_RELEASE}" "${PLATFORM_CHART_DIR}" -f "${PLATFORM_CHART_DIR}/examples/local.yaml" >/dev/null
  helm template "${PLATFORM_NOTIFICATIONS_HELM_RELEASE}" "${PLATFORM_NOTIFICATIONS_CHART_DIR}" -f "${platform_notifications_values}" >/dev/null
  helm template "${PLATFORM_NOTIFICATIONS_HELM_RELEASE}" "${PLATFORM_NOTIFICATIONS_CHART_DIR}" -f "${PLATFORM_NOTIFICATIONS_CHART_DIR}/examples/local.yaml" >/dev/null
  helm template "${ISTIO_PLATFORM_HELM_RELEASE}" "${ISTIO_PLATFORM_CHART_DIR}" -f "${istio_full_values}" >/dev/null
  helm template "${ISTIO_PLATFORM_HELM_RELEASE}" "${ISTIO_PLATFORM_CHART_DIR}" -f "${istio_preflight_values}" >/dev/null
  helm template "${ISTIO_PLATFORM_HELM_RELEASE}" "${ISTIO_PLATFORM_CHART_DIR}" -f "${ISTIO_PLATFORM_CHART_DIR}/examples/local.yaml" >/dev/null
  helm template "${TEMPORAL_HELM_RELEASE}" temporal --repo https://go.temporal.io/helm-charts --namespace "${INFRA_NAMESPACE}" -f "${temporal_values}" >/dev/null
  helm template "${KIALI_OPERATOR_HELM_RELEASE}" kiali-operator --repo https://kiali.org/helm-charts --namespace "${OBSERVABILITY_NAMESPACE}" -f "${kiali_operator_values}" >/dev/null

  for chart_dir in "${LOCAL_CHART_DIRS[@]}"; do
    package_chart_artifact "${chart_dir}" "${validate_pkg_dir}" "0.1.0-validate.0"
  done
}
