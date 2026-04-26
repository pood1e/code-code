#!/usr/bin/env bash
# Host-side Go build and thin image packaging.

go_target_package() {
  case "$1" in
    platform-auth-service) echo "packages/platform-k8s|./cmd/platform-auth-service" ;;
    platform-model-service) echo "packages/platform-k8s|./cmd/platform-model-service" ;;
    platform-provider-service) echo "packages/platform-k8s|./cmd/platform-provider-service" ;;
    platform-network-service) echo "packages/platform-k8s|./cmd/platform-network-service" ;;
    platform-profile-service) echo "packages/platform-k8s|./cmd/platform-profile-service" ;;
    platform-support-service) echo "packages/platform-k8s|./cmd/platform-support-service" ;;
    platform-cli-runtime-service) echo "packages/platform-k8s|./cmd/platform-cli-runtime-service" ;;
    platform-agent-runtime-service) echo "packages/platform-k8s|./cmd/platform-agent-runtime-service" ;;
    notification-dispatcher) echo "packages/platform-k8s|./cmd/notification-dispatcher" ;;
    wecom-callback-adapter) echo "packages/platform-k8s|./cmd/wecom-callback-adapter" ;;
    platform-chat-service) echo "packages/console-api|./cmd/platform-chat-service" ;;
    console-api) echo "packages/console-api|./cmd/console-api" ;;
    *) return 1 ;;
  esac
}

copy_local_ca_bundle() {
  local binary_dir="$1"
  local ca_source

  ca_source="$(resolve_ca_bundle || true)"
  if [ -z "${ca_source}" ]; then
    if [ -n "${GO_LOCAL_ALLOW_MISSING_CA_BUNDLE}" ]; then
      log "No CA bundle detected. Continue without CA bundle."
      : > "${binary_dir}/ca-certificates.crt"
      return
    fi
    echo "No CA bundle found on host. Set GO_LOCAL_CA_BUNDLE or GO_LOCAL_ALLOW_MISSING_CA_BUNDLE=1." >&2
    exit 1
  fi

  log "Using CA bundle from ${ca_source}"
  cp "${ca_source}" "${binary_dir}/ca-certificates.crt"
}

build_local_go_image() {
  local target="$1"
  local binary_dir="${REPO_ROOT}/${GO_LOCAL_DIST_DIR}"
  local binary_path="${binary_dir}/${target}"
  local image_name
  local mapping module_dir pkg_path
  local build_env=()

  if ! mapping="$(go_target_package "${target}")"; then
    echo "Unknown service: ${target}" >&2
    exit 1
  fi
  IFS='|' read -r module_dir pkg_path <<<"${mapping}"
  module_dir="${REPO_ROOT}/${module_dir}"
  image_name="$(image_ref_for_target "${target}")"

  mkdir -p "${binary_dir}" "${GO_LOCAL_GOCACHE}" "${GO_LOCAL_GOMODCACHE}"
  build_env=(
    GOOS="${GO_LOCAL_GOOS}"
    GOARCH="${GO_LOCAL_GOARCH}"
    GOFLAGS=-mod=readonly
    CGO_ENABLED=0
    GOCACHE="${GO_LOCAL_GOCACHE}"
    GOMODCACHE="${GO_LOCAL_GOMODCACHE}"
  )
  [ -n "${BUILD_GOPROXY}" ] && build_env+=(GOPROXY="${BUILD_GOPROXY}")

  log "Using IMAGE_TAG=${IMAGE_TAG}"
  log "Go caches: GOMODCACHE=${GO_LOCAL_GOMODCACHE} GOCACHE=${GO_LOCAL_GOCACHE}"
  log "Building local Go binary for ${target} in ${binary_path}"

  if [ -z "${GO_LOCAL_SKIP_MOD_DOWNLOAD}" ]; then
    log "Warming module cache for ${target}"
    ( cd "${module_dir}"; env "${build_env[@]}" go mod download )
  fi

  ( cd "${module_dir}"; env "${build_env[@]}" go build -buildvcs=false -trimpath -ldflags="${GO_LOCAL_LDFLAGS}" -o "${binary_path}" "${pkg_path}" )
  copy_local_ca_bundle "${binary_dir}"

  if [ ! -x "${binary_path}" ]; then
    echo "Expected binary missing: ${binary_path}" >&2
    exit 1
  fi

  log "Building local Go image from ${binary_path}"
  (
    cd "${REPO_ROOT}"
    container_cmd build \
      -f deploy/images/local/go.Dockerfile \
      -t "${image_name}" \
      --build-arg GO_LOCAL_CA_BUNDLE="ca-certificates.crt" \
      --build-arg GO_LOCAL_BINARY="${target}" \
      "${binary_dir}"
  )

  if image_gc_after_build_enabled; then
    cleanup_images "${target}"
  fi
}
