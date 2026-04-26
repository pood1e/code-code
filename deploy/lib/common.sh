#!/usr/bin/env bash
# Common utilities shared by all release modules.

log() {
  echo "==> $*"
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

container_cli_probe() {
  local candidate="$1"
  command -v "${candidate}" >/dev/null 2>&1 || return 1
  "${candidate}" info >/dev/null 2>&1
}

resolve_container_cli() {
  if [ -n "${CONTAINER_CLI:-}" ]; then
    if container_cli_probe "${CONTAINER_CLI}"; then
      return 0
    fi
    echo "Configured CONTAINER_CLI is not usable: ${CONTAINER_CLI}" >&2
    return 1
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
  return 1
}

container_cli_available() {
  resolve_container_cli >/dev/null 2>&1
}

require_container_cli() {
  if ! resolve_container_cli; then
    echo "Missing usable container CLI: expected docker or nerdctl." >&2
    exit 1
  fi
}

container_cmd() {
  require_container_cli
  if [ "${CONTAINER_CLI}" = "nerdctl" ] && [ -n "${CONTAINER_NERDCTL_NAMESPACE:-}" ]; then
    "${CONTAINER_CLI}" --namespace "${CONTAINER_NERDCTL_NAMESPACE}" "$@"
    return
  fi
  "${CONTAINER_CLI}" "$@"
}

require_file() {
  if [ ! -f "$1" ]; then
    echo "Missing required file: $1" >&2
    exit 1
  fi
}

is_no_pull_enabled() {
  [ "${BUILD_NO_PULL}" = "auto" ] || [ "${BUILD_NO_PULL}" = "1" ]
}

image_gc_after_build_enabled() {
  case "$(printf '%s' "${IMAGE_GC_AFTER_BUILD:-}" | tr '[:upper:]' '[:lower:]')" in
    ""|0|false|no|off) return 1 ;;
    *)                 return 0 ;;
  esac
}

is_known_target() {
  local candidate="$1"
  local target
  for target in "${ALL_TARGETS[@]}"; do
    if [ "${target}" = "${candidate}" ]; then
      return 0
    fi
  done
  return 1
}

add_selected_target() {
  local candidate="$1"
  local target
  if [ "${#SELECTED_TARGETS[@]}" -gt 0 ]; then
    for target in "${SELECTED_TARGETS[@]}"; do
      [ "${target}" = "${candidate}" ] && return
    done
  fi
  SELECTED_TARGETS+=("${candidate}")
}

add_target_group() {
  local target
  for target in "$@"; do
    add_selected_target "${target}"
  done
}

resolve_targets() {
  local target
  SELECTED_TARGETS=()
  if [ "$#" -eq 0 ]; then
    SELECTED_TARGETS=("${APP_TARGETS[@]}")
    return
  fi
  for target in "$@"; do
    case "${target}" in
      app) add_target_group "${APP_TARGETS[@]}"; continue ;;
      runtime) add_target_group "${RUNTIME_TARGETS[@]}"; continue ;;
      all) add_target_group "${ALL_TARGETS[@]}"; continue ;;
    esac
    if ! is_known_target "${target}"; then
      echo "Unknown target: ${target}" >&2
      usage >&2
      exit 1
    fi
    add_selected_target "${target}"
  done
}

image_ref_for_target() {
  local target="$1"
  local registry="${IMAGE_PUSH_REGISTRY:-${IMAGE_REGISTRY}}"
  if [[ "${target}" == *-egress-auth-wasm ]]; then
    registry="${WASM_IMAGE_PUSH_REGISTRY}"
  fi
  registry="$(registry_prefix "${registry}")"
  printf '%scode-code/%s:%s' "${registry}" "${target}" "${IMAGE_TAG}"
}

registry_prefix() {
  local registry="${1:-}"
  if [ -z "${registry}" ]; then
    return 0
  fi
  printf '%s/' "${registry%/}"
}

registry_authority() {
  local registry="${1:-}"
  registry="${registry#*://}"
  registry="${registry%/}"
  printf '%s' "${registry%%/*}"
}

append_csv_unique() {
  local current="${1:-}"
  local value="${2:-}"
  if [ -z "${value}" ]; then
    printf '%s' "${current}"
    return 0
  fi
  if [ -z "${current}" ]; then
    printf '%s' "${value}"
    return 0
  fi
  case ",${current}," in
    *",${value},"*) printf '%s' "${current}" ;;
    *)              printf '%s,%s' "${current}" "${value}" ;;
  esac
}

configure_wasm_registry_defaults() {
  local context
  local node_ip
  local pull_authority

  if [ -z "${WASM_IMAGE_REGISTRY}" ] && [ -n "${IMAGE_REGISTRY}" ]; then
    WASM_IMAGE_REGISTRY="${IMAGE_REGISTRY}"
  fi
  if [ -z "${WASM_IMAGE_PUSH_REGISTRY}" ] && [ -n "${WASM_IMAGE_REGISTRY}" ]; then
    WASM_IMAGE_PUSH_REGISTRY="${WASM_IMAGE_REGISTRY}"
  fi

  if [ -z "${WASM_IMAGE_REGISTRY}" ] && [ -z "${CI:-}" ] &&
    command -v kubectl >/dev/null 2>&1 &&
    container_cli_available &&
    command -v curl >/dev/null 2>&1; then
    context="$(kubectl config current-context 2>/dev/null || true)"
    if [ "${context}" = "colima" ] && curl -fsS --max-time 2 http://localhost:5001/v2/ >/dev/null 2>&1; then
      node_ip="$(kubectl get nodes -o jsonpath='{.items[0].status.addresses[?(@.type=="InternalIP")].address}' 2>/dev/null || true)"
      node_ip="${node_ip%% *}"
      if [ -n "${node_ip}" ]; then
        WASM_IMAGE_REGISTRY="${node_ip}:5001/"
        WASM_IMAGE_PUSH_REGISTRY="${WASM_IMAGE_PUSH_REGISTRY:-localhost:5001/}"
        log "Using local Colima Wasm registry: push via ${WASM_IMAGE_PUSH_REGISTRY}, pull via ${WASM_IMAGE_REGISTRY}"
      fi
    fi
  fi

  WASM_IMAGE_REGISTRY="$(registry_prefix "${WASM_IMAGE_REGISTRY}")"
  WASM_IMAGE_PUSH_REGISTRY="$(registry_prefix "${WASM_IMAGE_PUSH_REGISTRY}")"
  pull_authority="$(registry_authority "${WASM_IMAGE_REGISTRY}")"
  if [[ "${WASM_IMAGE_PUSH_REGISTRY}" == localhost:* || "${WASM_IMAGE_PUSH_REGISTRY}" == 127.0.0.1:* ]] &&
    [ -n "${pull_authority}" ]; then
    WASM_INSECURE_REGISTRIES="$(append_csv_unique "${WASM_INSECURE_REGISTRIES}" "${pull_authority}")"
  fi
  export WASM_IMAGE_REGISTRY WASM_IMAGE_PUSH_REGISTRY WASM_INSECURE_REGISTRIES
}

configure_console_ingress_defaults() {
  local context

  if [ -n "${CONSOLE_INGRESS_KUSTOMIZE_PATH}" ]; then
    return 0
  fi

  context="$(kubectl config current-context 2>/dev/null || true)"
  if [ "${context}" = "colima" ]; then
    CONSOLE_INGRESS_KUSTOMIZE_PATH="${REPO_ROOT}/deploy/k8s/console/overlays/local"
  else
    CONSOLE_INGRESS_KUSTOMIZE_PATH="${REPO_ROOT}/deploy/k8s/console/base"
  fi
  log "Using console ingress manifests: ${CONSOLE_INGRESS_KUSTOMIZE_PATH}"
  export CONSOLE_INGRESS_KUSTOMIZE_PATH
}

cache_ref_for_target() {
  local target="$1"
  printf '%s/%s:buildcache' "${CACHE_REF_PREFIX%/}" "${target}"
}

resolve_ca_bundle() {
  local candidate
  local paths=()
  if [ -n "${GO_LOCAL_CA_BUNDLE}" ]; then
    paths+=("${GO_LOCAL_CA_BUNDLE}")
  fi
  paths+=(
    "/etc/ssl/certs/ca-certificates.crt"
    "/etc/pki/tls/certs/ca-bundle.crt"
    "/etc/ssl/cert.pem"
    "/usr/local/etc/ssl/cert.pem"
    "/usr/local/etc/openssl/cert.pem"
    "/etc/pki/ca-trust/extracted/pem/tls-ca-bundle.pem"
    "/etc/pki/tls/cacert.pem"
    "/usr/share/pki/ca-trust-source/anchors/ca-bundle.trust.crt"
    "/etc/ssl/certs/ca-bundle.crt"
  )
  for candidate in "${paths[@]}"; do
    if [ -f "${candidate}" ]; then
      echo "${candidate}"
      return 0
    fi
  done
  return 1
}

pre_pull_if_missing() {
  local image="$1"
  if container_cmd image inspect "${image}" >/dev/null 2>&1; then
    return 0
  fi
  log "Pre-pulling missing base image ${image}"
  container_cmd pull "${image}"
}
