#!/usr/bin/env bash
# Host-side console-web build and thin image packaging.

pre_pull_local_web_base_image() {
  if ! is_no_pull_enabled; then
    return 0
  fi
  pre_pull_if_missing "nginxinc/nginx-unprivileged:1.29-alpine"
}

build_local_web_dist() {
  local web_dir="${REPO_ROOT}/packages/console-web"
  local dist_dir="${REPO_ROOT}/${BUILD_WEB_DIST_DIR}"
  local -a pnpm_cmd=()
  local dist_exists=0
  local pnpm_msg

  [ -f "${dist_dir}/index.html" ] && dist_exists=1
  if [ "${BUILD_WEB_REBUILD}" = "0" ] && [ "${dist_exists}" -eq 1 ]; then
    log "Reusing existing console-web dist: ${BUILD_WEB_DIST_DIR}"
    return 0
  fi

  if command -v pnpm >/dev/null 2>&1; then
    pnpm_cmd=(pnpm)
    pnpm_msg="pnpm"
  elif command -v corepack >/dev/null 2>&1; then
    pnpm_cmd=(corepack pnpm)
    pnpm_msg="corepack pnpm"
  else
    echo "Missing pnpm command. Install pnpm or enable corepack." >&2
    exit 1
  fi

  log "Building console-web dist with ${pnpm_msg}"
  (
    cd "${web_dir}"
    env \
      HTTP_PROXY="${BUILD_HTTP_PROXY}" \
      HTTPS_PROXY="${BUILD_HTTPS_PROXY}" \
      NO_PROXY="${BUILD_NO_PROXY}" \
      http_proxy="${BUILD_HTTP_PROXY}" \
      https_proxy="${BUILD_HTTPS_PROXY}" \
      no_proxy="${BUILD_NO_PROXY}" \
      COREPACK_NPM_REGISTRY="${BUILD_NPM_REGISTRY}" \
      NPM_CONFIG_REGISTRY="${BUILD_NPM_REGISTRY}" \
      npm_config_registry="${BUILD_NPM_REGISTRY}" \
      "${pnpm_cmd[@]}" install --frozen-lockfile --prefer-offline

    env \
      HTTP_PROXY="${BUILD_HTTP_PROXY}" \
      HTTPS_PROXY="${BUILD_HTTPS_PROXY}" \
      NO_PROXY="${BUILD_NO_PROXY}" \
      http_proxy="${BUILD_HTTP_PROXY}" \
      https_proxy="${BUILD_HTTPS_PROXY}" \
      no_proxy="${BUILD_NO_PROXY}" \
      NPM_CONFIG_REGISTRY="${BUILD_NPM_REGISTRY}" \
      npm_config_registry="${BUILD_NPM_REGISTRY}" \
      "${pnpm_cmd[@]}" --filter "@code-code/console-web-app..." build
  )

  if [ ! -f "${dist_dir}/index.html" ]; then
    echo "Console-web build did not generate ${BUILD_WEB_DIST_DIR}/index.html" >&2
    echo "Command failed: ${pnpm_msg} --filter \"@code-code/console-web-app...\" build" >&2
    exit 1
  fi
}

build_local_web_image() {
  require_container_cli
  local image_name pull_flag="" dist_dir="${REPO_ROOT}/${BUILD_WEB_DIST_DIR}"

  if [ ! -f "${dist_dir}/index.html" ]; then
    echo "Missing local web dist entry file: ${dist_dir}/index.html" >&2
    echo "Run: pnpm --dir packages/console-web install && pnpm --filter \"@code-code/console-web-app...\" build" >&2
    exit 1
  fi

  log "Using IMAGE_TAG=${IMAGE_TAG}"
  log "Building local web-only image from ${BUILD_WEB_DIST_DIR}"
  image_name="$(image_ref_for_target "console-web")"

  if is_no_pull_enabled; then
    pull_flag="--pull=false"
  fi

  pre_pull_local_web_base_image

  cd "${REPO_ROOT}"
  container_cmd build ${pull_flag:+${pull_flag}} \
    --build-context image-config=deploy/images \
    -f deploy/images/local/console-web.Dockerfile \
    -t "${image_name}" \
    "${dist_dir}"
}
