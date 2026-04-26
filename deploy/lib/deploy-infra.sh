#!/usr/bin/env bash
# Infrastructure installation and local development secrets.

infra_mode() {
  printf '%s' "${DEPLOY_INFRA_MODE:-auto}" | tr '[:upper:]' '[:lower:]'
}

infra_mode_is_skip() {
  case "$(infra_mode)" in
    skip|app|0|false|no|off) return 0 ;;
    *)                       return 1 ;;
  esac
}

ensure_infrastructure_secrets() {
  require_secret_keys "${INFRA_NAMESPACE}" postgres-auth \
    POSTGRES_DB POSTGRES_USER POSTGRES_PASSWORD DATABASE_URL
  require_secret_keys "${NAMESPACE}" postgres-auth DATABASE_URL
  require_secret_keys "${OBSERVABILITY_NAMESPACE}" alertmanager-receivers wechat-api-secret
}

ensure_grafana_secrets() {
  require_secret_keys "${OBSERVABILITY_NAMESPACE}" grafana-admin \
    GF_SECURITY_ADMIN_USER GF_SECURITY_ADMIN_PASSWORD
}

ensure_cloudflare_ddns_secret() {
  require_secret_keys "${INFRA_NAMESPACE}" cloudflare-ddns-token token
}

ensure_ingress_nginx_repo() {
  require_cmd helm
  if ! helm repo list | awk 'NR>1 {print $1}' | grep -Fxq ingress-nginx; then
    helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx >/dev/null 2>&1 || true
  fi
  case "$(printf '%s' "${HELM_REPO_UPDATE_MODE:-on-demand}" | tr '[:upper:]' '[:lower:]')" in
    always|1|true|yes|on)
      helm repo update ingress-nginx >/dev/null
      ;;
    *)
      log "Skipping ingress-nginx repo update (HELM_REPO_UPDATE_MODE=${HELM_REPO_UPDATE_MODE:-on-demand})"
      ;;
  esac
}

require_secret_keys() {
  local namespace="$1"
  local secret_name="$2"
  shift 2
  local key
  local keys_output

  if ! kubectl get secret "${secret_name}" -n "${namespace}" >/dev/null 2>&1; then
    echo "Missing required Secret ${namespace}/${secret_name}." >&2
    echo "Create it before running deploy." >&2
    exit 1
  fi

  keys_output="$(kubectl get secret "${secret_name}" -n "${namespace}" -o go-template='{{range $k,$v := .data}}{{printf "%s\n" $k}}{{end}}')"
  for key in "$@"; do
    if ! printf '%s\n' "${keys_output}" | grep -Fxq "${key}"; then
      echo "Missing required key ${key} in Secret ${namespace}/${secret_name}." >&2
      exit 1
    fi
  done
}

wait_for_ingress_nginx_rollout() {
  log "Waiting for ingress-nginx rollout status"
  kubectl rollout status deployment/ingress-nginx-controller \
    -n "${INGRESS_NGINX_NAMESPACE}" \
    --timeout="${INGRESS_NGINX_HELM_TIMEOUT}"
}

wait_for_core_infrastructure_rollouts() {
  log "Waiting for infrastructure-core rollout status"
  kubectl rollout status statefulset/postgres -n "${INFRA_NAMESPACE}" --timeout="${PLATFORM_ROLLOUT_TIMEOUT}"
  kubectl rollout status statefulset/nats -n "${INFRA_NAMESPACE}" --timeout="${PLATFORM_ROLLOUT_TIMEOUT}"
  kubectl rollout status deployment/otel-collector -n "${OBSERVABILITY_NAMESPACE}" --timeout="${PLATFORM_ROLLOUT_TIMEOUT}"
  kubectl rollout status statefulset/prometheus -n "${OBSERVABILITY_NAMESPACE}" --timeout="${PLATFORM_ROLLOUT_TIMEOUT}"
  kubectl rollout status statefulset/alertmanager -n "${OBSERVABILITY_NAMESPACE}" --timeout="${PLATFORM_ROLLOUT_TIMEOUT}"
}

wait_for_cluster_addons_rollouts() {
  log "Waiting for cluster-addons rollout status"
  kubectl rollout status deployment/metrics-server -n kube-system --timeout="${PLATFORM_ROLLOUT_TIMEOUT}"
}

wait_for_infrastructure_addons_rollouts() {
  if infra_addon_enabled tempo "$@"; then
    kubectl rollout status deployment/tempo -n "${OBSERVABILITY_NAMESPACE}" --timeout="${PLATFORM_ROLLOUT_TIMEOUT}"
  fi
  if infra_addon_enabled loki "$@"; then
    kubectl rollout status statefulset/loki -n "${OBSERVABILITY_NAMESPACE}" --timeout="${PLATFORM_ROLLOUT_TIMEOUT}"
  fi
  if infra_addon_enabled alloy "$@"; then
    kubectl rollout status deployment/alloy -n "${OBSERVABILITY_NAMESPACE}" --timeout="${PLATFORM_ROLLOUT_TIMEOUT}"
  fi
  if infra_addon_enabled grafana "$@"; then
    kubectl rollout status deployment/grafana -n "${OBSERVABILITY_NAMESPACE}" --timeout="${PLATFORM_ROLLOUT_TIMEOUT}"
  fi
  if infra_addon_enabled cloudflare-ddns "$@"; then
    kubectl rollout status deployment/cloudflare-ddns -n "${INFRA_NAMESPACE}" --timeout="${PLATFORM_ROLLOUT_TIMEOUT}"
  fi
}

wait_for_kiali_rollout() {
  log "Waiting for Kiali rollout status"
  kubectl rollout status deployment/kiali-operator -n "${OBSERVABILITY_NAMESPACE}" --timeout="${PLATFORM_ROLLOUT_TIMEOUT}"
  wait_for_deployment_exists "${OBSERVABILITY_NAMESPACE}" kiali 60
  kubectl rollout status deployment/kiali -n "${OBSERVABILITY_NAMESPACE}" --timeout="${PLATFORM_ROLLOUT_TIMEOUT}"
}

wait_for_deployment_exists() {
  local namespace="$1"
  local name="$2"
  local timeout_seconds="${3:-60}"
  local elapsed=0

  while [ "${elapsed}" -lt "${timeout_seconds}" ]; do
    if kubectl get deployment "${name}" -n "${namespace}" >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
    elapsed=$((elapsed + 2))
  done

  echo "Timed out waiting for deployment ${namespace}/${name} to be created." >&2
  return 1
}

deploy_ingress_nginx() {
  local helm_args=()

  ensure_ingress_nginx_repo
  if helm_release_deployed "${INGRESS_NGINX_HELM_RELEASE}" "${INGRESS_NGINX_NAMESPACE}" && [ -z "${INGRESS_NGINX_VALUES_FILE}" ] && [ -z "${INGRESS_NGINX_VERSION}" ]; then
    log "Skipping ingress-nginx (release already deployed and no explicit values change)"
    return 0
  fi
  if ! helm_release_has_changes "${INGRESS_NGINX_HELM_RELEASE}" "${INGRESS_NGINX_NAMESPACE}" "ingress-nginx/ingress-nginx" "${INGRESS_NGINX_VALUES_FILE}" "${INGRESS_NGINX_VERSION}"; then
    log "Skipping ingress-nginx (no manifest changes)"
    return 0
  fi

  helm_args=(
    upgrade --install "${INGRESS_NGINX_HELM_RELEASE}" ingress-nginx/ingress-nginx
    --namespace "${INGRESS_NGINX_NAMESPACE}"
    --create-namespace
    --history-max "${HELM_HISTORY_MAX}"
    --wait
    --timeout "${INGRESS_NGINX_HELM_TIMEOUT}"
  )
  if [ -n "${INGRESS_NGINX_VERSION}" ]; then
    helm_args+=(--version "${INGRESS_NGINX_VERSION}")
  fi
  if [ -n "${INGRESS_NGINX_VALUES_FILE}" ]; then
    require_file "${INGRESS_NGINX_VALUES_FILE}"
    helm_args+=(-f "${INGRESS_NGINX_VALUES_FILE}")
  fi

  log "Deploying ingress-nginx"
  helm "${helm_args[@]}"
}

deploy_temporal() {
  local values_file

  require_cmd helm
  values_file="$(mktemp "${TMP_RELEASE_DIR}/temporal-values.XXXX.yaml")"
  write_temporal_values_file "${values_file}"

  log "Deploying Temporal"
  helm upgrade --install "${TEMPORAL_HELM_RELEASE}" temporal \
    --repo https://go.temporal.io/helm-charts \
    -n "${INFRA_NAMESPACE}" \
    --create-namespace \
    --take-ownership \
    -f "${values_file}" \
    --wait \
    --timeout "${TEMPORAL_HELM_TIMEOUT}" \
    --history-max "${HELM_HISTORY_MAX}"
}

deploy_kiali_operator() {
  local values_file

  require_cmd helm
  values_file="$(mktemp "${TMP_RELEASE_DIR}/kiali-operator-values.XXXX.yaml")"
  write_kiali_operator_values_file "${values_file}"

  log "Deploying Kiali operator"
  helm upgrade --install "${KIALI_OPERATOR_HELM_RELEASE}" kiali-operator \
    --repo https://kiali.org/helm-charts \
    -n "${OBSERVABILITY_NAMESPACE}" \
    --create-namespace \
    --take-ownership \
    -f "${values_file}" \
    --wait \
    --timeout "${KIALI_OPERATOR_HELM_TIMEOUT}" \
    --history-max "${HELM_HISTORY_MAX}"
}

deploy_cluster_addons() {
  deploy_ingress_nginx
  wait_for_ingress_nginx_rollout
  deploy_cluster_bootstrap_chart
  deploy_cluster_addons_chart
  wait_for_cluster_addons_rollouts
}

deploy_dev_image_infra() {
  local addon_targets=("$@")

  [ "${#addon_targets[@]}" -ne 0 ] || addon_targets=(all)

  deploy_cluster_bootstrap_chart
  deploy_dev_image_infra_chart "${addon_targets[@]}"
}

deploy_infrastructure_addons() {
  local addon_targets=("$@")

  [ "${#addon_targets[@]}" -ne 0 ] || addon_targets=(all)

  deploy_ingress_nginx
  wait_for_ingress_nginx_rollout
  deploy_cluster_bootstrap_chart
  if infra_addon_enabled tempo "${addon_targets[@]}"; then
    ensure_infrastructure_secrets
    deploy_infrastructure_core_chart true
    wait_for_core_infrastructure_rollouts
  fi
  if infra_addon_enabled grafana "${addon_targets[@]}"; then
    ensure_grafana_secrets
  fi
  if infra_addon_enabled cloudflare-ddns "${addon_targets[@]}"; then
    ensure_cloudflare_ddns_secret
  fi
  if infra_addon_enabled kiali "${addon_targets[@]}"; then
    deploy_kiali_operator
  fi
  deploy_infrastructure_addons_chart "${addon_targets[@]}"
  wait_for_infrastructure_addons_rollouts "${addon_targets[@]}"
  if infra_addon_enabled kiali "${addon_targets[@]}"; then
    wait_for_kiali_rollout
  fi
}

deploy_infrastructure() {
  deploy_ingress_nginx
  wait_for_ingress_nginx_rollout

  if infra_mode_is_skip; then
    log "Skipping infrastructure apply/wait (DEPLOY_INFRA_MODE=skip)"
    return
  fi

  deploy_cluster_bootstrap_chart
  ensure_infrastructure_secrets
  deploy_infrastructure_core_chart false
  wait_for_core_infrastructure_rollouts
  deploy_temporal
}
