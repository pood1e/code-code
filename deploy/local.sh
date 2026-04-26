#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=$(cd "${SCRIPT_DIR}/.." && pwd)

LOCAL_REGISTRY="${LOCAL_REGISTRY:-localhost:5001}"
LOCAL_REGISTRY_CONTAINER="${LOCAL_REGISTRY_CONTAINER:-code-code-registry}"
LOCAL_REGISTRY_BIND_HOST="${LOCAL_REGISTRY_BIND_HOST:-127.0.0.1}"

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

export LOCAL_REGISTRY
export IMAGE_REGISTRY="${IMAGE_REGISTRY:-${LOCAL_REGISTRY}/}"
export CLI_RUNTIME_IMAGE_REGISTRY_LOOKUP_PREFIX="${CLI_RUNTIME_IMAGE_REGISTRY_LOOKUP_PREFIX:-${LOCAL_REGISTRY}/}"
export CLI_RUNTIME_IMAGE_REGISTRY_LOOKUP_INSECURE="${CLI_RUNTIME_IMAGE_REGISTRY_LOOKUP_INSECURE:-true}"
export IMAGE_TAG="${IMAGE_TAG:-$(default_image_tag)}"
export BUILD_GO_MODE="${BUILD_GO_MODE:-local}"
export BUILD_WEB_MODE="${BUILD_WEB_MODE:-local}"
export BUILD_NO_PULL="${BUILD_NO_PULL:-auto}"

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || { echo "Missing required command: $1" >&2; exit 1; }
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

container_cli_probe() {
  local candidate="$1"
  command -v "${candidate}" >/dev/null 2>&1 || return 1
  "${candidate}" info >/dev/null 2>&1
}

require_container_cli() {
  if [ -n "${CONTAINER_CLI:-}" ] && container_cli_probe "${CONTAINER_CLI}"; then
    return 0
  fi
  if container_cli_probe docker; then
    CONTAINER_CLI="docker"
    export CONTAINER_CLI
    return 0
  fi
  if container_cli_probe nerdctl; then
    CONTAINER_CLI="nerdctl"
    export CONTAINER_CLI
    return 0
  fi
  echo "Missing usable container CLI: expected docker or nerdctl." >&2
  exit 1
}

registry_delete_enabled() {
  "${CONTAINER_CLI}" inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "${LOCAL_REGISTRY_CONTAINER}" 2>/dev/null |
    grep -Fxq 'REGISTRY_STORAGE_DELETE_ENABLED=true'
}

registry_host_authority() {
  local registry
  registry="${LOCAL_REGISTRY#*://}"
  registry="${registry%/}"
  printf '%s\n' "${registry%%/*}"
}

registry_bind_port() {
  local authority
  authority="$(registry_host_authority)"
  if [[ "${authority}" != *:* ]]; then
    echo "LOCAL_REGISTRY must include an explicit port, got: ${LOCAL_REGISTRY}" >&2
    exit 1
  fi
  printf '%s\n' "${authority##*:}"
}

ensure_registry() {
  local bind_port
  require_container_cli
  bind_port="$(registry_bind_port)"

  if "${CONTAINER_CLI}" inspect "${LOCAL_REGISTRY_CONTAINER}" >/dev/null 2>&1; then
    if ! registry_delete_enabled; then
      echo "Warning: existing registry ${LOCAL_REGISTRY_CONTAINER} was created without REGISTRY_STORAGE_DELETE_ENABLED=true; CLI image retention cannot delete old tags until it is recreated." >&2
    fi
    "${CONTAINER_CLI}" start "${LOCAL_REGISTRY_CONTAINER}" >/dev/null
    return
  fi

  "${CONTAINER_CLI}" run -d --restart=always \
    -p "${LOCAL_REGISTRY_BIND_HOST}:${bind_port}:5000" \
    --name "${LOCAL_REGISTRY_CONTAINER}" \
    -v "${LOCAL_REGISTRY_CONTAINER}:/var/lib/registry" \
    -e REGISTRY_STORAGE_DELETE_ENABLED=true \
    registry:2 >/dev/null
}

setup() {
  ensure_colima_inotify_limits
  require_container_cli
  ensure_registry
}

usage() {
  cat <<'EOF'
Usage:
  deploy/local.sh setup
  deploy/local.sh build [app|runtime|all|target...]
  deploy/local.sh push [app|runtime|all|target...]
  deploy/local.sh deploy
  deploy/local.sh all [app|runtime|all|target...]
EOF
}

command="${1:-setup}"
shift || true

case "${command}" in
  setup)
    setup
    ;;
  cache)
    # Backward-compatible alias. Cache provisioning is now environment-specific.
    setup
    ;;
  build)
    "${REPO_ROOT}/deploy/release.sh" build "$@"
    ;;
  push)
    ensure_registry
    "${REPO_ROOT}/deploy/release.sh" push "$@"
    ;;
  deploy)
    "${REPO_ROOT}/deploy/release.sh" deploy
    ;;
  all)
    setup
    "${REPO_ROOT}/deploy/release.sh" build "$@"
    "${REPO_ROOT}/deploy/release.sh" push "$@"
    "${REPO_ROOT}/deploy/release.sh" deploy
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
