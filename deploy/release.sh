#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=$(cd "${SCRIPT_DIR}/.." && pwd)

source "${SCRIPT_DIR}/lib/targets.sh"
source "${SCRIPT_DIR}/lib/config.sh"

# --- Mutable state ---

TMP_CACHE_EXPORT_DIR=""
TMP_RELEASE_DIR=""
SELECTED_TARGETS=()
BUILDX_TARGETS=()
LOCAL_WEB_TARGETS=()
LOCAL_GO_TARGETS=()
BAKE_ARGS=()

cleanup() {
  if declare -F restore_scheduled_workflows >/dev/null 2>&1; then
    restore_scheduled_workflows || true
  fi
  [ -n "${TMP_CACHE_EXPORT_DIR}" ] && [ -d "${TMP_CACHE_EXPORT_DIR}" ] && rm -rf "${TMP_CACHE_EXPORT_DIR}"
  [ -n "${TMP_RELEASE_DIR}" ] && [ -d "${TMP_RELEASE_DIR}" ] && rm -rf "${TMP_RELEASE_DIR}"
  :
}
trap cleanup EXIT

# --- Load modules ---

source "${SCRIPT_DIR}/lib/common.sh"
source "${SCRIPT_DIR}/lib/cache.sh"
source "${SCRIPT_DIR}/lib/cleanup.sh"
source "${SCRIPT_DIR}/lib/build.sh"
source "${SCRIPT_DIR}/lib/build-local-web.sh"
source "${SCRIPT_DIR}/lib/build-local-go.sh"
source "${SCRIPT_DIR}/lib/charts.sh"
source "${SCRIPT_DIR}/lib/validate-workflows.sh"
source "${SCRIPT_DIR}/lib/deploy-infra.sh"
source "${SCRIPT_DIR}/lib/deploy-egress.sh"
source "${SCRIPT_DIR}/lib/deploy.sh"

# --- Usage ---

usage() {
  cat <<'EOF'
Usage:
  deploy/release.sh build [app|runtime|all|target...]
  deploy/release.sh push [app|runtime|all|target...]
  deploy/release.sh deploy
  deploy/release.sh deploy-addon <cluster-addons|infrastructure-addons|dev-image-infra|platform-notifications|all> [grafana|tempo|loki|alloy|kiali|cloudflare-ddns|registry|cache|all]
  deploy/release.sh validate
  deploy/release.sh package-charts
  deploy/release.sh push-charts
  deploy/release.sh clean [app|runtime|all|target...]
  deploy/release.sh build-local-web
  deploy/release.sh build-local-go <service>

Targets:
  app (default): platform-auth-service  platform-model-service  platform-network-service  platform-provider-service  platform-profile-service  platform-support-service  platform-cli-runtime-service  platform-agent-runtime-service  notification-dispatcher  wecom-callback-adapter  platform-chat-service  console-api  console-web  agent-runtime-egress-auth-wasm  control-plane-egress-auth-wasm
  runtime: claude-code-agent  agent-cli-qwen  agent-cli-gemini  cli-output-sidecar

Defaults:
  no target means app
  local shells build Go/Vite on the host
  CI uses release Dockerfiles
EOF
}

# --- Command dispatch ---

COMMAND="${1:-build}"
case "${COMMAND}" in
  build|clean|build-local-go|build-local-web|push|deploy|deploy-addon|validate|package-charts|push-charts|help|-h|--help) shift || true ;;
  *) COMMAND="build" ;;
esac

case "${COMMAND}" in
  build)          resolve_targets "$@"; build_images ;;
  clean)          resolve_targets "$@"; cleanup_images "${SELECTED_TARGETS[@]}" ;;
  build-local-web) build_local_web_image ;;
  build-local-go)
    if [ "$#" -ne 1 ]; then
      echo "build-local-go requires exactly one service name argument." >&2
      usage >&2; exit 1
    fi
    build_local_go_image "$1"
    ;;
  push)           resolve_targets "$@"; push_images ;;
  deploy)         deploy_images "$@" ;;
  deploy-addon)   deploy_addons "$@" ;;
  validate)
    configure_wasm_registry_defaults
    configure_console_ingress_defaults
    TMP_RELEASE_DIR=$(mktemp -d "${SCRIPT_DIR}/.release-tmp.XXXXXX")
    validate_workflow_manifests
    validate_charts
    ;;
  package-charts) package_charts ;;
  push-charts)    push_charts ;;
  help|-h|--help) usage ;;
esac
