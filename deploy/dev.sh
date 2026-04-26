#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=$(cd "${SCRIPT_DIR}/.." && pwd)

readonly RELEASE_SCRIPT="${SCRIPT_DIR}/release.sh"
readonly LOCAL_SCRIPT="${SCRIPT_DIR}/local.sh"

NAMESPACE="${NAMESPACE:-code-code}"
INFRA_NAMESPACE="${INFRA_NAMESPACE:-${NAMESPACE}-infra}"
OBSERVABILITY_NAMESPACE="${OBSERVABILITY_NAMESPACE:-${NAMESPACE}-observability}"
ISTIO_NAMESPACE="${ISTIO_NAMESPACE:-istio-system}"

usage() {
  cat <<'EOF'
Usage:
  deploy/dev.sh setup
  deploy/dev.sh build [app|runtime|all|target...]
  deploy/dev.sh push [app|runtime|all|target...]
  deploy/dev.sh deploy
  deploy/dev.sh addon <cluster-addons|infrastructure-addons|dev-image-infra|platform-notifications|all> [grafana|tempo|loki|alloy|kiali|cloudflare-ddns|registry|cache|all]
  deploy/dev.sh up [app|runtime|all|target...]
  deploy/dev.sh validate
  deploy/dev.sh status
  deploy/dev.sh restart <deployment> [namespace]
  deploy/dev.sh logs <deployment> [namespace] [--follow]

`up` behavior:
  - DEV_UP_BUILD=auto|true|false (default auto)
    auto: build only when a usable container CLI is available
  - DEV_UP_PUSH=auto|true|false (default auto)
    auto: push only when IMAGE_REGISTRY is non-empty
EOF
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

ensure_colima_inotify_limits() {
  local context
  local desired_instances
  local desired_queue

  if ! command -v kubectl >/dev/null 2>&1; then
    return 0
  fi
  context="$(kubectl config current-context 2>/dev/null || true)"
  if [ "${context}" != "colima" ]; then
    return 0
  fi
  if ! command -v colima >/dev/null 2>&1; then
    echo "Warning: current context is colima, but 'colima' CLI is not available; skipping inotify sysctl setup." >&2
    return 0
  fi

  desired_instances="${COLIMA_INOTIFY_MAX_USER_INSTANCES:-8192}"
  desired_queue="${COLIMA_INOTIFY_MAX_QUEUED_EVENTS:-16384}"

  colima ssh -- sudo sysctl -q -w "fs.inotify.max_user_instances=${desired_instances}" >/dev/null
  colima ssh -- sudo sysctl -q -w "fs.inotify.max_queued_events=${desired_queue}" >/dev/null
  colima ssh -- sudo sh -c "cat > /etc/sysctl.d/99-code-code-inotify.conf <<'EOF'
fs.inotify.max_user_instances=${desired_instances}
fs.inotify.max_queued_events=${desired_queue}
EOF" >/dev/null
}

run_release() {
  "${RELEASE_SCRIPT}" "$@"
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

image_ref_tag() {
  local image="${1:-}"
  image="${image%@*}"
  if [[ "${image}" != *:* ]]; then
    return 1
  fi
  printf '%s\n' "${image##*:}"
}

default_image_tag() {
  local head
  head="$(git -C "${REPO_ROOT}" rev-parse --short HEAD)"
  if ! git -C "${REPO_ROOT}" diff --quiet ||
    ! git -C "${REPO_ROOT}" diff --cached --quiet ||
    [ -n "$(git -C "${REPO_ROOT}" status --porcelain --untracked-files=normal)" ]; then
    printf '%s-dirty-%s\n' "${head}" "$(date +%Y%m%d%H%M%S)"
    return
  fi
  printf '%s\n' "${head}"
}

resolve_cluster_image_tag() {
  local deployment
  local image
  local tag

  require_cmd kubectl
  for deployment in platform-auth-service console-web platform-network-service; do
    image="$(kubectl get deployment "${deployment}" -n "${NAMESPACE}" -o jsonpath='{.spec.template.spec.containers[0].image}' 2>/dev/null || true)"
    [ -n "${image}" ] || continue
    if tag="$(image_ref_tag "${image}")"; then
      printf '%s\n' "${tag}"
      return 0
    fi
  done
  return 1
}

apply_up_ingress_defaults() {
  if [ -z "${CONSOLE_INGRESS_HOST:-}" ]; then
    CONSOLE_INGRESS_HOST="$(local_ingress_host console)"
  fi
  if [ -z "${CONSOLE_INGRESS_SSL_REDIRECT:-}" ]; then
    CONSOLE_INGRESS_SSL_REDIRECT="false"
  fi
  if [ -z "${CONSOLE_INGRESS_TLS_ENABLED:-}" ]; then
    CONSOLE_INGRESS_TLS_ENABLED="false"
  fi

  if [ -z "${KIALI_INGRESS_HOST:-}" ]; then
    KIALI_INGRESS_HOST="$(local_ingress_host kiali)"
  fi
  if [ -z "${KIALI_INGRESS_TLS_ENABLED:-}" ]; then
    KIALI_INGRESS_TLS_ENABLED="false"
  fi

  if [ -z "${GRAFANA_INGRESS_HOST:-}" ]; then
    GRAFANA_INGRESS_HOST="$(local_ingress_host grafana)"
  fi
  if [ -z "${GRAFANA_INGRESS_TLS_ENABLED:-}" ]; then
    GRAFANA_INGRESS_TLS_ENABLED="false"
  fi

  export CONSOLE_INGRESS_HOST CONSOLE_INGRESS_SSL_REDIRECT CONSOLE_INGRESS_TLS_ENABLED
  export KIALI_INGRESS_HOST KIALI_INGRESS_TLS_ENABLED
  export GRAFANA_INGRESS_HOST GRAFANA_INGRESS_TLS_ENABLED
}

to_lower() {
  printf '%s' "$1" | tr '[:upper:]' '[:lower:]'
}

container_cli_probe() {
  local candidate="$1"
  command -v "${candidate}" >/dev/null 2>&1 || return 1
  "${candidate}" info >/dev/null 2>&1
}

preferred_container_cli() {
  if [ -n "${CONTAINER_CLI:-}" ]; then
    if container_cli_probe "${CONTAINER_CLI}"; then
      printf '%s\n' "${CONTAINER_CLI}"
      return 0
    fi
    return 1
  fi
  if container_cli_probe docker; then
    printf 'docker\n'
    return 0
  fi
  if container_cli_probe nerdctl; then
    printf 'nerdctl\n'
    return 0
  fi
  return 1
}

container_engine_usable() {
  preferred_container_cli >/dev/null 2>&1
}

is_truthy() {
  case "$(to_lower "${1:-}")" in
    1|true|yes|on|always) return 0 ;;
    *)                    return 1 ;;
  esac
}

is_falsy() {
  case "$(to_lower "${1:-}")" in
    0|false|no|off|never) return 0 ;;
    *)                    return 1 ;;
  esac
}

should_build_images_for_up() {
  local mode
  mode="$(to_lower "${DEV_UP_BUILD:-auto}")"
  if is_truthy "${mode}"; then
    return 0
  fi
  if is_falsy "${mode}"; then
    return 1
  fi
  container_engine_usable
}

should_push_images_for_up() {
  local mode
  mode="$(to_lower "${DEV_UP_PUSH:-auto}")"
  if is_truthy "${mode}"; then
    return 0
  fi
  if is_falsy "${mode}"; then
    return 1
  fi
  [ -n "${IMAGE_REGISTRY:-}" ]
}

registry_service_exists() {
  kubectl get service code-code-registry -n "${INFRA_NAMESPACE}" >/dev/null 2>&1
}

registry_service_host() {
  printf 'code-code-registry.%s.svc.cluster.local:5000\n' "${INFRA_NAMESPACE}"
}

registry_service_node_port() {
  kubectl get service code-code-registry -n "${INFRA_NAMESPACE}" \
    -o jsonpath='{.spec.ports[0].nodePort}' 2>/dev/null || true
}

ensure_up_registry_ready() {
  require_cmd kubectl
  if registry_service_exists; then
    return 0
  fi
  echo "==> Installing dev image registry/cache chart for local push/pull." >&2
  run_release deploy-addon dev-image-infra registry cache
}

apply_up_registry_defaults() {
  local node_port
  local node_ip

  if [ -z "${IMAGE_REGISTRY:-}" ] && registry_service_exists; then
    node_port="$(registry_service_node_port)"
    node_ip="$(kubectl get nodes -o jsonpath='{.items[0].status.addresses[?(@.type=="InternalIP")].address}' 2>/dev/null || true)"
    node_ip="${node_ip%% *}"
    if [ -n "${node_ip}" ] && [ -n "${node_port}" ]; then
      IMAGE_REGISTRY="${node_ip}:${node_port}"
    else
      IMAGE_REGISTRY="$(registry_service_host)"
    fi
    export IMAGE_REGISTRY
    echo "==> Using pull registry IMAGE_REGISTRY=${IMAGE_REGISTRY}" >&2
  fi

  if [ -z "${IMAGE_PUSH_REGISTRY:-}" ] && [ -n "${IMAGE_REGISTRY:-}" ] && registry_service_exists; then
    node_port="${node_port:-$(registry_service_node_port)}"
    if [ -n "${node_port}" ] && command -v curl >/dev/null 2>&1 &&
      curl -fsS --max-time 2 "http://127.0.0.1:${node_port}/v2/" >/dev/null 2>&1; then
      IMAGE_PUSH_REGISTRY="127.0.0.1:${node_port}"
    else
      IMAGE_PUSH_REGISTRY="${IMAGE_REGISTRY}"
    fi
    export IMAGE_PUSH_REGISTRY
    echo "==> Using push registry IMAGE_PUSH_REGISTRY=${IMAGE_PUSH_REGISTRY}" >&2
  fi
}

ensure_up_image_tag() {
  if [ -n "${IMAGE_TAG:-}" ]; then
    return 0
  fi
  IMAGE_TAG="$(default_image_tag)"
  export IMAGE_TAG
  echo "==> Using pinned IMAGE_TAG=${IMAGE_TAG} for this up run." >&2
}

run_up_flow() {
  local -a targets=()
  if [ "$#" -gt 0 ]; then
    targets=("$@")
  fi
  local build_mode
  local push_mode
  local reuse_tag
  local runtime_cli
  local nerdctl_local_image_mode=false

  ensure_colima_inotify_limits

  build_mode="$(to_lower "${DEV_UP_BUILD:-auto}")"
  push_mode="$(to_lower "${DEV_UP_PUSH:-auto}")"
  apply_up_ingress_defaults
  runtime_cli="$(preferred_container_cli || true)"
  if [ "${runtime_cli}" = "nerdctl" ] &&
    [ -z "${IMAGE_REGISTRY:-}" ] &&
    [ -z "${IMAGE_PUSH_REGISTRY:-}" ] &&
    [ "${push_mode}" = "auto" ]; then
    nerdctl_local_image_mode=true
    CONTAINER_NERDCTL_NAMESPACE="${CONTAINER_NERDCTL_NAMESPACE:-k8s.io}"
    export CONTAINER_NERDCTL_NAMESPACE
    echo "==> Using nerdctl local image mode (namespace=${CONTAINER_NERDCTL_NAMESPACE}); skipping registry defaults." >&2
  fi
  if [ "${nerdctl_local_image_mode}" = false ]; then
    if ! is_falsy "${push_mode}"; then
      ensure_up_registry_ready
    fi
    apply_up_registry_defaults
    if ! is_falsy "${push_mode}" && [ -z "${IMAGE_REGISTRY:-}" ]; then
      echo "IMAGE_REGISTRY is empty and no registry is available for push/pull." >&2
      exit 1
    fi
  fi
  if should_build_images_for_up; then
    ensure_up_image_tag
    if [ "${#targets[@]}" -gt 0 ]; then
      run_release build "${targets[@]}"
    else
      run_release build
    fi
  else
    if [ -z "${IMAGE_TAG:-}" ]; then
      reuse_tag="$(resolve_cluster_image_tag || true)"
      if [ -n "${reuse_tag}" ]; then
        IMAGE_TAG="${reuse_tag}"
        export IMAGE_TAG
        echo "==> Reusing cluster IMAGE_TAG=${IMAGE_TAG} because image build is skipped." >&2
      else
        echo "Warning: unable to resolve IMAGE_TAG from cluster; deploy may point to unavailable tags." >&2
      fi
    fi
    if is_falsy "${build_mode}"; then
      echo "==> Skipping image build (DEV_UP_BUILD=${DEV_UP_BUILD:-auto})." >&2
    else
      echo "==> Skipping image build (DEV_UP_BUILD=${DEV_UP_BUILD:-auto}; no usable container CLI)." >&2
    fi
  fi

  if should_push_images_for_up; then
    if [ -z "${IMAGE_REGISTRY:-}" ]; then
      echo "DEV_UP_PUSH requests push but IMAGE_REGISTRY is empty." >&2
      exit 1
    fi
    if [ "${#targets[@]}" -gt 0 ]; then
      run_release push "${targets[@]}"
    else
      run_release push
    fi
  else
    if is_falsy "${push_mode}"; then
      echo "==> Skipping image push (DEV_UP_PUSH=${DEV_UP_PUSH:-auto})." >&2
    else
      echo "==> Skipping image push (DEV_UP_PUSH=${DEV_UP_PUSH:-auto}; IMAGE_REGISTRY is empty)." >&2
    fi
  fi

  run_release deploy
}

show_status() {
  require_cmd kubectl
  echo "==> context: $(kubectl config current-context 2>/dev/null || echo unknown)"
  echo "==> namespace deployments (${NAMESPACE})"
  kubectl get deploy -n "${NAMESPACE}"
  echo "==> infra workloads (${INFRA_NAMESPACE})"
  kubectl get deploy,statefulset -n "${INFRA_NAMESPACE}" || true
  echo "==> observability workloads (${OBSERVABILITY_NAMESPACE})"
  kubectl get deploy,statefulset -n "${OBSERVABILITY_NAMESPACE}" || true
  echo "==> istio workloads (${ISTIO_NAMESPACE})"
  kubectl get deploy -n "${ISTIO_NAMESPACE}" || true
}

restart_deployment() {
  require_cmd kubectl
  local deployment="$1"
  local namespace="${2:-${NAMESPACE}}"
  kubectl rollout restart "deployment/${deployment}" -n "${namespace}"
  kubectl rollout status "deployment/${deployment}" -n "${namespace}" --timeout="${PLATFORM_ROLLOUT_TIMEOUT:-60s}"
}

logs_deployment() {
  require_cmd kubectl
  local deployment="$1"
  local namespace="$2"
  local follow="$3"
  local pod

  pod="$(kubectl get pods -n "${namespace}" -l "app.kubernetes.io/name=${deployment}" -o jsonpath='{.items[0].metadata.name}')"
  if [ -z "${pod}" ]; then
    echo "No pod found for deployment ${deployment} in namespace ${namespace}" >&2
    exit 1
  fi
  if [ "${follow}" = "true" ]; then
    kubectl logs -n "${namespace}" "${pod}" -f --tail=200
  else
    kubectl logs -n "${namespace}" "${pod}" --tail=200
  fi
}

command="${1:-help}"
shift || true

case "${command}" in
  setup|setup-local)
    ensure_colima_inotify_limits
    "${LOCAL_SCRIPT}" setup
    ;;
  build)
    run_release build "$@"
    ;;
  push)
    run_release push "$@"
    ;;
  deploy)
    run_release deploy
    ;;
  addon)
    if [ "$#" -lt 1 ]; then
      echo "addon requires at least one target." >&2
      usage >&2
      exit 1
    fi
    run_release deploy-addon "$@"
    ;;
  up)
    run_up_flow "$@"
    ;;
  validate)
    run_release validate
    ;;
  status)
    show_status
    ;;
  restart)
    if [ "$#" -lt 1 ] || [ "$#" -gt 2 ]; then
      echo "restart requires <deployment> [namespace]." >&2
      usage >&2
      exit 1
    fi
    restart_deployment "$1" "${2:-${NAMESPACE}}"
    ;;
  logs)
    if [ "$#" -lt 1 ] || [ "$#" -gt 3 ]; then
      echo "logs requires <deployment> [namespace] [--follow]." >&2
      usage >&2
      exit 1
    fi
    deployment="$1"
    namespace="${2:-${NAMESPACE}}"
    follow="false"
    if [ "${3:-}" = "--follow" ]; then
      follow="true"
    elif [ -n "${3:-}" ]; then
      echo "third argument for logs must be --follow." >&2
      exit 1
    fi
    logs_deployment "${deployment}" "${namespace}" "${follow}"
    ;;
  help|-h|--help)
    usage
    ;;
  *)
    echo "Unknown command: ${command}" >&2
    usage >&2
    exit 1
    ;;
esac
