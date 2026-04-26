#!/usr/bin/env bash
# Cache preparation and finalization for buildx local/registry cache.

prepare_local_cache_args() {
  local target cache_dir tmp_cache_dir
  local -a targets=("$@")

  if [ "${#targets[@]}" -eq 0 ]; then
    return
  fi

  mkdir -p "${CACHE_DIR}"
  TMP_CACHE_EXPORT_DIR=$(mktemp -d "${CACHE_DIR}.tmp.XXXXXX")

  for target in "${targets[@]}"; do
    cache_dir="${CACHE_DIR}/${target}"
    tmp_cache_dir="${TMP_CACHE_EXPORT_DIR}/${target}"
    mkdir -p "${tmp_cache_dir}"

    if [ -f "${cache_dir}/index.json" ]; then
      BAKE_ARGS+=(--set "${target}.cache-from=type=local,src=${cache_dir}")
    fi

    BAKE_ARGS+=(--set "${target}.cache-to=type=local,dest=${tmp_cache_dir},mode=max")
  done
}

prepare_registry_cache_args() {
  local target
  local -a targets=("$@")

  if [ -z "${CACHE_REF_PREFIX}" ] || [ "${#targets[@]}" -eq 0 ]; then
    return
  fi

  for target in "${targets[@]}"; do
    BAKE_ARGS+=(--set "${target}.cache-from=type=registry,ref=$(cache_ref_for_target "${target}")")
    BAKE_ARGS+=(--set "${target}.cache-to=type=registry,ref=$(cache_ref_for_target "${target}"),mode=max")
  done
}

finalize_local_cache() {
  local target cache_dir tmp_cache_dir
  local -a targets=("$@")

  if [ "${#targets[@]}" -eq 0 ]; then
    return
  fi

  if [ -z "${TMP_CACHE_EXPORT_DIR}" ] || [ ! -d "${TMP_CACHE_EXPORT_DIR}" ]; then
    return
  fi

  for target in "${targets[@]}"; do
    tmp_cache_dir="${TMP_CACHE_EXPORT_DIR}/${target}"
    if [ ! -d "${tmp_cache_dir}" ]; then
      continue
    fi
    cache_dir="${CACHE_DIR}/${target}"
    rm -rf "${cache_dir}"
    mv "${tmp_cache_dir}" "${cache_dir}"
  done

  rm -rf "${TMP_CACHE_EXPORT_DIR}"
  TMP_CACHE_EXPORT_DIR=""
}
