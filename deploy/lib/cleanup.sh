#!/usr/bin/env bash
# Docker image cleanup — per-service image pruning and system-wide GC.

cleanup_service_images() {
  local target="$1"
  local keep_recent="${IMAGE_KEEP_RECENT_IMAGES}"
  local repo_ref selector current_ref image_count kept_count ref tmp_file
  local removed_count=0
  local keep_refs=""

  if ! [[ "${keep_recent}" =~ ^[0-9]+$ ]] || [ "${keep_recent}" -lt 1 ]; then
    echo "IMAGE_KEEP_RECENT_IMAGES must be a positive integer: ${keep_recent}" >&2
    return 1
  fi

  repo_ref="$(registry_prefix "${IMAGE_PUSH_REGISTRY:-${IMAGE_REGISTRY}}")code-code/${target}"
  selector="${repo_ref}:*"
  current_ref="${repo_ref}:${IMAGE_TAG}"
  tmp_file="$(mktemp)"

  while IFS= read -r ref; do
    local created
    created="$(container_cmd image inspect -f '{{.Created}}' "${ref}" 2>/dev/null || true)"
    if [ -n "${created}" ]; then
      echo "${created} ${ref}" >> "${tmp_file}"
    fi
  done < <(container_cmd images --filter "reference=${selector}" --format '{{.Repository}}:{{.Tag}}' | awk 'NF' | sort -u)

  image_count="$(wc -l < "${tmp_file}" | tr -d ' ')"
  if [ "${image_count}" -eq 0 ]; then
    rm -f "${tmp_file}"
    log "No images found for ${target}."
    return 0
  fi

  if container_cmd image inspect "${current_ref}" >/dev/null 2>&1; then
    keep_refs="${current_ref}"
  fi

  kept_count=0
  if [ -n "${keep_refs}" ]; then
    kept_count=1
  fi

  while read -r created ref; do
    if [ -z "${created}" ] || [ -z "${ref}" ]; then
      continue
    fi
    if [ -n "${keep_refs}" ] && printf '%s\n' "${keep_refs}" | grep -Fxq "${ref}" 2>/dev/null; then
      continue
    fi
    if [ "${kept_count}" -lt "${keep_recent}" ]; then
      keep_refs="${keep_refs}"$'\n'"${ref}"
      kept_count=$((kept_count + 1))
      continue
    fi
    if container_cmd image rm "${ref}" >/dev/null 2>&1; then
      removed_count=$((removed_count + 1))
      log "Deleted image tag ${ref}"
    else
      log "Skip image tag ${ref} for ${target}, may still be referenced by a container"
    fi
  done < <(sort -r "${tmp_file}" | awk '!seen[$2]++')

  rm -f "${tmp_file}"

  if [ "${removed_count}" -eq 0 ]; then
    log "No historical images removed for ${target}."
  fi
}

cleanup_images() {
  local target
  local targets=()

  if [ "$#" -gt 0 ]; then
    targets=("$@")
  else
    targets=("${SELECTED_TARGETS[@]}")
  fi

  if ! [[ "${IMAGE_GC_UNTIL_DAYS}" =~ ^[0-9]+$ ]]; then
    echo "IMAGE_GC_UNTIL_DAYS must be a non-negative integer: ${IMAGE_GC_UNTIL_DAYS}" >&2
    return 1
  fi

  require_container_cli

  for target in "${targets[@]}"; do
    cleanup_service_images "${target}"
  done

  if [ "${IMAGE_GC_UNTIL_DAYS}" -gt 0 ]; then
    local gc_hours=$((IMAGE_GC_UNTIL_DAYS * 24))
    log "Pruning unreferenced container artifacts older than ${IMAGE_GC_UNTIL_DAYS} days"
    container_cmd image prune --filter "until=${gc_hours}h" --force >/dev/null 2>&1 || true
    container_cmd builder prune --filter "until=${gc_hours}h" --force >/dev/null 2>&1 || true
  fi
}
