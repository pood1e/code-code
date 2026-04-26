#!/usr/bin/env bash
# Docker buildx bake orchestration — target splitting, pre-pull, and bake invocation.

is_go_target() {
  local candidate="$1"
  local target
  for target in "${GO_TARGETS[@]}"; do
    [ "${target}" = "${candidate}" ] && return 0
  done
  return 1
}

split_targets_for_build() {
  local target
  BUILDX_TARGETS=()
  LOCAL_WEB_TARGETS=()
  LOCAL_GO_TARGETS=()

  for target in "${SELECTED_TARGETS[@]}"; do
    if [ "${target}" = "console-web" ]; then
      if [ "${BUILD_WEB_MODE}" = "local" ]; then
        LOCAL_WEB_TARGETS+=("console-web")
      else
        BUILDX_TARGETS+=("console-web")
      fi
      continue
    fi
    if is_go_target "${target}" && [ "${BUILD_GO_MODE}" = "local" ]; then
      LOCAL_GO_TARGETS+=("${target}")
    else
      BUILDX_TARGETS+=("${target}")
    fi
  done
}

pre_pull_base_images() {
  local targets=("$@")
  local has_frontend_base=false
  local has_go_base=false
  local has_node_base=false
  local has_rust_base=false
  local target

  if ! is_no_pull_enabled || [ "${#targets[@]}" -eq 0 ]; then
    return 0
  fi

  for target in "${targets[@]}"; do
    if [ "${target}" = "console-web" ]; then
      has_frontend_base=true
    elif [[ "${target}" == *-egress-auth-wasm ]]; then
      has_rust_base=true
    elif [[ "${target}" == agent-cli-* || "${target}" = "claude-code-agent" ]]; then
      has_node_base=true
    else
      has_go_base=true
    fi
  done

  if [ "${has_frontend_base}" = true ]; then
    pre_pull_if_missing "node:24-bookworm"
    pre_pull_if_missing "nginxinc/nginx-unprivileged:1.29-alpine"
  fi
  if [ "${has_node_base}" = true ]; then
    pre_pull_if_missing "node:24-bookworm-slim"
  fi
  if [ "${has_rust_base}" = true ]; then
    pre_pull_if_missing "rust:1.88-bookworm"
  fi
  if [ "${has_go_base}" = true ]; then
    pre_pull_if_missing "golang:1.26-bookworm"
  fi
}

build_images() {
  local target

  split_targets_for_build

  log "Using IMAGE_TAG=${IMAGE_TAG}"
  log "Building targets: ${SELECTED_TARGETS[*]+${SELECTED_TARGETS[*]}}"
  log "Buildx targets: ${BUILDX_TARGETS[*]+${BUILDX_TARGETS[*]}}; local web: ${LOCAL_WEB_TARGETS[*]+${LOCAL_WEB_TARGETS[*]}}; local go: ${LOCAL_GO_TARGETS[*]+${LOCAL_GO_TARGETS[*]}}"

  require_container_cli

  if [ "${#LOCAL_WEB_TARGETS[@]}" -gt 0 ]; then
    build_local_web_dist
    for target in "${LOCAL_WEB_TARGETS[@]}"; do
      build_local_web_image "${target}"
    done
  fi

  if [ "${#LOCAL_GO_TARGETS[@]}" -gt 0 ]; then
    for target in "${LOCAL_GO_TARGETS[@]}"; do
      build_local_go_image "${target}"
    done
  fi

  if [ "${#BUILDX_TARGETS[@]}" -eq 0 ]; then
    if image_gc_after_build_enabled && [ "${#SELECTED_TARGETS[@]}" -gt 0 ]; then
      cleanup_images "${SELECTED_TARGETS[@]}"
    fi
    return
  fi

  pre_pull_base_images "${BUILDX_TARGETS[@]}"
  if [ "${CONTAINER_CLI}" != "docker" ]; then
    echo "Current container CLI (${CONTAINER_CLI}) does not support buildx bake." >&2
    echo "Set BUILD_WEB_MODE=local and BUILD_GO_MODE=local, or install a usable docker daemon." >&2
    exit 1
  fi
  docker buildx version >/dev/null

  BAKE_ARGS=(buildx bake)
  if is_no_pull_enabled; then
    BAKE_ARGS+=(--pull=false)
  fi
  BAKE_ARGS+=(--load -f deploy/images/docker-bake.hcl)
  prepare_local_cache_args "${BUILDX_TARGETS[@]}"
  prepare_registry_cache_args "${BUILDX_TARGETS[@]}"

  # All BUILD_* vars are exported in release.sh; bake reads them from environment.
  (
    cd "${REPO_ROOT}"
    docker "${BAKE_ARGS[@]}" "${BUILDX_TARGETS[@]}"
  )

  finalize_local_cache "${BUILDX_TARGETS[@]}"

  if image_gc_after_build_enabled && [ "${#SELECTED_TARGETS[@]}" -gt 0 ]; then
    cleanup_images "${SELECTED_TARGETS[@]}"
  fi
}

push_images() {
  local target
  local registry

  require_container_cli
  configure_wasm_registry_defaults

  log "Using IMAGE_TAG=${IMAGE_TAG}"
  log "Pushing targets: ${SELECTED_TARGETS[*]}"

  for target in "${SELECTED_TARGETS[@]}"; do
    registry="${IMAGE_PUSH_REGISTRY:-${IMAGE_REGISTRY}}"
    if [[ "${target}" == *-egress-auth-wasm ]]; then
      registry="${WASM_IMAGE_PUSH_REGISTRY}"
    fi
    if [ -z "${registry}" ]; then
      echo "IMAGE_REGISTRY must be set for push." >&2
      if [[ "${target}" == *-egress-auth-wasm ]]; then
        echo "Set WASM_IMAGE_PUSH_REGISTRY for Wasm OCI image publication." >&2
      fi
      exit 1
    fi
    container_cmd push "$(image_ref_for_target "${target}")"
  done
}

deploy_push_wasm_images_enabled() {
  case "$(printf '%s' "${DEPLOY_PUSH_WASM_IMAGES:-auto}" | tr '[:upper:]' '[:lower:]')" in
    ""|0|false|no|off) return 1 ;;
    *)                 return 0 ;;
  esac
}

publish_wasm_images_for_deploy() {
  local target
  local local_ref
  local remote_ref
  local mode

  configure_wasm_registry_defaults
  deploy_push_wasm_images_enabled || return 0
  [ -n "${WASM_IMAGE_PUSH_REGISTRY}" ] || return 0

  mode="$(printf '%s' "${DEPLOY_PUSH_WASM_IMAGES:-auto}" | tr '[:upper:]' '[:lower:]')"
  if ! container_cli_available; then
    if [ "${mode}" = "required" ]; then
      echo "Missing usable container CLI: expected docker or nerdctl." >&2
      exit 1
    fi
    log "Skipping Wasm image publish; no usable container CLI"
    return 0
  fi
  for target in agent-runtime-egress-auth-wasm control-plane-egress-auth-wasm; do
    local_ref="code-code/${target}:${IMAGE_TAG}"
    remote_ref="$(image_ref_for_target "${target}")"
    if [ "${local_ref}" = "${remote_ref}" ]; then
      continue
    fi
    if ! container_cmd image inspect "${local_ref}" >/dev/null 2>&1; then
      if [ "${mode}" = "required" ]; then
        echo "Missing local Wasm image ${local_ref}; build app or set DEPLOY_PUSH_WASM_IMAGES=auto to skip." >&2
        exit 1
      fi
      log "Skipping Wasm image publish; ${local_ref} is not present locally"
      continue
    fi
    log "Publishing ${target} to ${remote_ref}"
    container_cmd tag "${local_ref}" "${remote_ref}"
    container_cmd push "${remote_ref}"
  done
}
