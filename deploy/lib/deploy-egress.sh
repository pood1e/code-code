#!/usr/bin/env bash
# Istio Ambient egress dependencies.

helm_release_uses_chart_version() {
  local release="$1"
  local namespace="$2"
  local chart_version="$3"
  local chart="${release}-${chart_version}"
  local releases

  releases=$(helm list -n "${namespace}" --filter "^${release}$" --output json 2>/dev/null || true)
  [[ "${releases}" == *"\"status\":\"deployed\""* && "${releases}" == *"\"chart\":\"${chart}\""* ]]
}

deployment_available() {
  local namespace="$1"
  local deployment="$2"
  local available

  available=$(kubectl -n "${namespace}" get deployment "${deployment}" \
    -o jsonpath='{.status.availableReplicas}' 2>/dev/null || true)
  [[ "${available:-0}" -gt 0 ]]
}

deploy_cert_manager() {
  require_cmd helm
  if helm_release_uses_chart_version cert-manager "${CERT_MANAGER_NAMESPACE}" "${CERT_MANAGER_VERSION}"; then
    log "cert-manager ${CERT_MANAGER_VERSION} already deployed"
    return 0
  fi
  log "Installing cert-manager ${CERT_MANAGER_VERSION}"
  helm upgrade --install cert-manager oci://quay.io/jetstack/charts/cert-manager \
    --version "${CERT_MANAGER_VERSION}" \
    --namespace "${CERT_MANAGER_NAMESPACE}" \
    --create-namespace \
    --history-max "${HELM_HISTORY_MAX}" \
    --set crds.enabled=true \
    --wait \
    --timeout "${CERT_MANAGER_HELM_TIMEOUT}"
}

deploy_trust_manager() {
  require_cmd helm
  if helm_release_uses_chart_version trust-manager "${CERT_MANAGER_NAMESPACE}" "${TRUST_MANAGER_VERSION}" &&
    deployment_available "${CERT_MANAGER_NAMESPACE}" trust-manager; then
    log "trust-manager ${TRUST_MANAGER_VERSION} already deployed"
    return 0
  fi
  log "Installing trust-manager ${TRUST_MANAGER_VERSION}"
  helm upgrade --install trust-manager oci://quay.io/jetstack/charts/trust-manager \
    --version "${TRUST_MANAGER_VERSION}" \
    --namespace "${CERT_MANAGER_NAMESPACE}" \
    --history-max "${HELM_HISTORY_MAX}" \
    --set app.trust.namespace="${CERT_MANAGER_NAMESPACE}" \
    --set app.leaderElection.leaseDuration=60s \
    --set app.leaderElection.renewDeadline=40s \
    --set app.webhook.tls.approverPolicy.enabled=false \
    --wait \
    --timeout "${CERT_MANAGER_HELM_TIMEOUT}"
}

deploy_egress_certificates() {
  deploy_cert_manager
  deploy_trust_manager
}

ensure_istio_repo() {
  require_cmd helm
  if ! helm repo list | awk 'NR>1 {print $1}' | grep -Fxq istio; then
    helm repo add istio https://istio-release.storage.googleapis.com/charts >/dev/null 2>&1 || true
  fi
  case "$(printf '%s' "${HELM_REPO_UPDATE_MODE:-on-demand}" | tr '[:upper:]' '[:lower:]')" in
    always|1|true|yes|on)
      helm repo update istio >/dev/null
      ;;
    *)
      log "Skipping istio repo update (HELM_REPO_UPDATE_MODE=${HELM_REPO_UPDATE_MODE:-on-demand})"
      ;;
  esac
}

deploy_istio_ambient() {
  ensure_istio_repo

  log "Installing Istio Ambient ${ISTIO_VERSION}"
  helm upgrade --install istio-base istio/base \
    --version "${ISTIO_VERSION}" \
    --namespace "${ISTIO_NAMESPACE}" \
    --create-namespace \
    --history-max "${HELM_HISTORY_MAX}" \
    --wait \
    --timeout "${ISTIO_HELM_TIMEOUT}"

  helm upgrade --install istiod istio/istiod \
    --version "${ISTIO_VERSION}" \
    --namespace "${ISTIO_NAMESPACE}" \
    --set profile=ambient \
    --set "pilot.resources.requests.cpu=${ISTIOD_REQUEST_CPU}" \
    --set "pilot.resources.requests.memory=${ISTIOD_REQUEST_MEMORY}" \
    --set "pilot.resources.limits.cpu=${ISTIOD_LIMIT_CPU}" \
    --set "pilot.resources.limits.memory=${ISTIOD_LIMIT_MEMORY}" \
    --set meshConfig.enableTracing=true \
    --set "meshConfig.defaultProviders.tracing[0]=otel-tracing" \
    --set "meshConfig.extensionProviders[0].name=otel-tracing" \
    --set "meshConfig.extensionProviders[0].opentelemetry.service=${ISTIO_OTEL_COLLECTOR_SERVICE}" \
    --set "meshConfig.extensionProviders[0].opentelemetry.port=4317" \
    --history-max "${HELM_HISTORY_MAX}" \
    --wait \
    --timeout "${ISTIO_HELM_TIMEOUT}"

  helm upgrade --install istio-cni istio/cni \
    --version "${ISTIO_VERSION}" \
    --namespace "${ISTIO_NAMESPACE}" \
    --set profile=ambient \
    --history-max "${HELM_HISTORY_MAX}" \
    --wait \
    --timeout "${ISTIO_HELM_TIMEOUT}"

  helm upgrade --install ztunnel istio/ztunnel \
    --version "${ISTIO_VERSION}" \
    --namespace "${ISTIO_NAMESPACE}" \
    --set "resources.requests.cpu=${ZTUNNEL_REQUEST_CPU}" \
    --set "resources.requests.memory=${ZTUNNEL_REQUEST_MEMORY}" \
    --set "resources.limits.cpu=${ZTUNNEL_LIMIT_CPU}" \
    --set "resources.limits.memory=${ZTUNNEL_LIMIT_MEMORY}" \
    --history-max "${HELM_HISTORY_MAX}" \
    --wait \
    --timeout "${ISTIO_HELM_TIMEOUT}"
}

deploy_istio_egress_gateway() {
  ensure_istio_repo
  local helm_args

  log "Installing Istio egress gateway ${ISTIO_VERSION}"
  helm_args=(
    upgrade --install "${ISTIO_EGRESS_GATEWAY_RELEASE}" istio/gateway
    --version "${ISTIO_VERSION}" \
    --namespace "${ISTIO_EGRESS_GATEWAY_NAMESPACE}" \
    --create-namespace \
    --history-max "${HELM_HISTORY_MAX}" \
    --set service.type=ClusterIP \
    --set autoscaling.enabled=false \
    --set replicaCount=1 \
    --set resources.requests.cpu=50m \
    --set resources.requests.memory=128Mi \
    --set resources.limits.cpu=500m \
    --set resources.limits.memory=512Mi \
    --wait \
    --timeout "${ISTIO_HELM_TIMEOUT}"
  )
  if [ -n "${WASM_INSECURE_REGISTRIES}" ]; then
    helm_args+=(--set "env.WASM_INSECURE_REGISTRIES=${WASM_INSECURE_REGISTRIES}")
  fi
  helm "${helm_args[@]}"
}

wait_for_egress_gateway() {
  kubectl rollout status \
    "deployment/${ISTIO_EGRESS_GATEWAY_RELEASE}" \
    -n "${ISTIO_EGRESS_GATEWAY_NAMESPACE}" \
    --timeout="${ISTIO_HELM_TIMEOUT}"
}
