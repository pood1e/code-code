#!/usr/bin/env bash
# Kubernetes rollout orchestration.

readonly PLATFORM_ROLLOUT_DEPLOYMENTS=(
  platform-auth-service
  platform-model-service
  platform-provider-service
  platform-network-service
  platform-profile-service
  platform-support-service
  platform-cli-runtime-service
  platform-agent-runtime-service
  platform-chat-service
  console-api
  console-web
)

readonly PLATFORM_NOTIFICATIONS_ROLLOUT_DEPLOYMENTS=(
  notification-dispatcher
  apprise-api
  wecom-callback-adapter
  wecom-robot-default-callback-adapter
)

readonly PLATFORM_PREFLIGHT_IMAGE_NAMES=(
  platform-auth-service
  platform-model-service
  platform-provider-service
  platform-network-service
  platform-profile-service
  platform-support-service
  platform-cli-runtime-service
  platform-agent-runtime-service
  platform-chat-service
  console-api
  console-web
)

to_lower() {
  printf '%s' "$1" | tr '[:upper:]' '[:lower:]'
}

is_truthy() {
  case "$(to_lower "${1:-}")" in
    1|true|yes|on) return 0 ;;
    *)             return 1 ;;
  esac
}

image_preflight_enabled() {
  is_truthy "${DEPLOY_IMAGE_PREFLIGHT_ENABLED:-true}"
}

duration_to_seconds() {
  local value="${1:-}"
  case "${value}" in
    *m) printf '%s\n' "$(( ${value%m} * 60 ))" ;;
    *s) printf '%s\n' "${value%s}" ;;
    "") printf '45\n' ;;
    *)  printf '%s\n' "${value}" ;;
  esac
}

deploy_image_registry_prefix() {
  local registry="${IMAGE_REGISTRY:-}"
  if [ -z "${registry}" ]; then
    return 0
  fi
  printf '%s/' "${registry%/}"
}

deploy_image_ref() {
  local image_name="$1"
  printf '%scode-code/%s:%s' "$(deploy_image_registry_prefix)" "${image_name}" "${IMAGE_TAG}"
}

image_preflight_pod_name() {
  local image="$1"
  local sanitized
  sanitized="$(printf '%s' "${image}" | tr '[:upper:]' '[:lower:]' | tr '/:._' '-' | tr -cd 'a-z0-9-')"
  sanitized="${sanitized#-}"
  sanitized="${sanitized%-}"
  sanitized="${sanitized:0:40}"
  if [ -z "${sanitized}" ]; then
    sanitized="image"
  fi
  printf 'image-preflight-%s-%s\n' "${sanitized}" "$(printf '%s' "${RANDOM}" | tail -c 5)"
}

delete_preflight_pod() {
  local namespace="$1"
  local pod_name="$2"
  kubectl delete pod "${pod_name}" -n "${namespace}" \
    --ignore-not-found \
    --force \
    --grace-period=0 \
    --wait=false >/dev/null 2>&1 || true
}

image_already_running_in_namespace() {
  local namespace="$1"
  local image="$2"
  local images

  images="$(kubectl get pods -n "${namespace}" -o jsonpath='{range .items[*]}{range .spec.containers[*]}{.image}{"\n"}{end}{end}' 2>/dev/null || true)"
  printf '%s\n' "${images}" | grep -Fxq "${image}"
}

preflight_image_pull() {
  local namespace="$1"
  local image="$2"
  local pod_name timeout_seconds start_seconds pull_policy
  local template_file rendered_manifest
  local phase waiting_reason running_started terminated_reason container_started
  local status

  timeout_seconds="$(duration_to_seconds "${DEPLOY_IMAGE_PREFLIGHT_TIMEOUT:-45s}")"
  pod_name="$(image_preflight_pod_name "${image}")"
  if [ -z "${IMAGE_REGISTRY:-}" ]; then
    pull_policy="Never"
  else
    pull_policy="Always"
  fi
  template_file="${REPO_ROOT}/deploy/k8s/preflight/image-pull-check-pod.yaml"
  require_file "${template_file}"
  rendered_manifest="$(
    sed \
      -e "s|__POD_NAME__|${pod_name}|g" \
      -e "s|__NAMESPACE__|${namespace}|g" \
      -e "s|__IMAGE__|${image}|g" \
      -e "s|__IMAGE_PULL_POLICY__|${pull_policy}|g" \
      "${template_file}"
  )"

  delete_preflight_pod "${namespace}" "${pod_name}"
  printf '%s\n' "${rendered_manifest}" | kubectl apply -f - >/dev/null

  start_seconds="${SECONDS}"
  while [ $((SECONDS - start_seconds)) -lt "${timeout_seconds}" ]; do
    status="$(kubectl get pod "${pod_name}" -n "${namespace}" -o go-template='{{.status.phase}}|{{if .status.containerStatuses}}{{with index .status.containerStatuses 0}}{{if .state.waiting}}{{.state.waiting.reason}}{{end}}|{{if .state.running}}{{.state.running.startedAt}}{{end}}|{{if .state.terminated}}{{.state.terminated.reason}}{{end}}|{{.started}}{{end}}{{else}}|||{{end}}' 2>/dev/null || true)"
    IFS='|' read -r phase waiting_reason running_started terminated_reason container_started <<<"${status}"

    case "${waiting_reason:-}" in
      ErrImagePull|ImagePullBackOff|ErrImageNeverPull|InvalidImageName|RegistryUnavailable)
        echo "Image preflight failed: ${image} (${waiting_reason})" >&2
        kubectl get events -n "${namespace}" --field-selector "involvedObject.name=${pod_name}" --sort-by=.lastTimestamp | tail -n 5 >&2 || true
        delete_preflight_pod "${namespace}" "${pod_name}"
        return 1
        ;;
    esac

    if [ "${container_started:-}" = "true" ] || [ -n "${running_started:-}" ] || [ -n "${terminated_reason:-}" ]; then
      delete_preflight_pod "${namespace}" "${pod_name}"
      return 0
    fi

    case "${phase:-}" in
      Running|Succeeded|Failed)
        delete_preflight_pod "${namespace}" "${pod_name}"
        return 0
        ;;
    esac

    sleep 2
  done

  echo "Image preflight timed out after ${timeout_seconds}s: ${image}" >&2
  kubectl get pod "${pod_name}" -n "${namespace}" -o wide >&2 || true
  kubectl get events -n "${namespace}" --field-selector "involvedObject.name=${pod_name}" --sort-by=.lastTimestamp | tail -n 5 >&2 || true
  delete_preflight_pod "${namespace}" "${pod_name}"
  return 1
}

verify_platform_images_pullable() {
  local image_name image
  local mode

  if ! image_preflight_enabled; then
    log "Skipping image preflight (DEPLOY_IMAGE_PREFLIGHT_ENABLED=${DEPLOY_IMAGE_PREFLIGHT_ENABLED:-false})"
    return 0
  fi

  if [ -z "${IMAGE_REGISTRY:-}" ]; then
    mode="local-image"
  else
    mode="registry"
  fi
  log "Preflight checking deploy images (mode=${mode}, timeout=${DEPLOY_IMAGE_PREFLIGHT_TIMEOUT:-45s})"
  for image_name in "${PLATFORM_PREFLIGHT_IMAGE_NAMES[@]}"; do
    image="$(deploy_image_ref "${image_name}")"
    if image_already_running_in_namespace "${NAMESPACE}" "${image}"; then
      continue
    fi
    preflight_image_pull "${NAMESPACE}" "${image}"
  done
}

restart_deployments() {
  local namespace="$1"
  shift
  local deployment

  for deployment in "$@"; do
    kubectl rollout restart "deployment/${deployment}" -n "${namespace}"
  done
}

wait_for_deployments() {
  local namespace="$1"
  shift
  local deployment

  for deployment in "$@"; do
    kubectl rollout status "deployment/${deployment}" -n "${namespace}" --timeout="${PLATFORM_ROLLOUT_TIMEOUT}"
  done
}

validate_infrastructure_addon_targets() {
  local target

  [ "$#" -ne 0 ] || return 0
  for target in "$@"; do
    case "${target}" in
      all|grafana|tempo|loki|alloy|kiali|cloudflare-ddns) ;;
      *)
        echo "unsupported infrastructure addon target: ${target}" >&2
        exit 1
        ;;
    esac
  done
}

validate_dev_image_infra_addon_targets() {
  local target

  [ "$#" -ne 0 ] || return 0
  for target in "$@"; do
    case "${target}" in
      all|registry|cache) ;;
      *)
        echo "unsupported dev-image-infra addon target: ${target}" >&2
        exit 1
        ;;
    esac
  done
}

deploy_foundation() {
  deploy_infrastructure
}

deploy_egress_path() {
  deploy_istio_ambient
  deploy_egress_certificates
  deploy_istio_platform_chart preflight
  deploy_istio_egress_gateway
  deploy_platform_chart preflight
  kubectl rollout status "deployment/platform-network-service" -n "${NAMESPACE}" --timeout="${PLATFORM_ROLLOUT_TIMEOUT}"
  wait_for_egress_gateway
  deploy_istio_platform_chart full
}

deploy_workflow_runtime() {
  :
}

deploy_platform_services() {
  deploy_platform_chart full
}

restart_platform_deployments() {
  [ -n "${FORCE_RESTART}" ] || return 0
  log "Force-restarting deployments"
  restart_deployments "${NAMESPACE}" "${PLATFORM_ROLLOUT_DEPLOYMENTS[@]}"
}

wait_for_rollouts() {
  log "Waiting for rollout status"
  wait_for_deployments "${NAMESPACE}" "${PLATFORM_ROLLOUT_DEPLOYMENTS[@]}"
}

deploy_platform_notifications() {
  log "Deploying platform notifications"
  deploy_ingress_nginx
  wait_for_ingress_nginx_rollout
  require_secret_keys "${NAMESPACE}" notification-apprise-urls urls
  require_secret_keys "${NAMESPACE}" wecom-callback encoding-aes-key token
  require_secret_keys "${NAMESPACE}" wecom-robot-default-callback encoding-aes-key token
  deploy_platform_notifications_chart
  if [ -n "${FORCE_RESTART}" ]; then
    restart_deployments "${NAMESPACE}" "${PLATFORM_NOTIFICATIONS_ROLLOUT_DEPLOYMENTS[@]}"
  fi
  wait_for_deployments "${NAMESPACE}" "${PLATFORM_NOTIFICATIONS_ROLLOUT_DEPLOYMENTS[@]}"
}

deploy_images() {
  require_cmd kubectl

  if [ "$#" -ne 0 ]; then
    echo "deploy does not accept target arguments." >&2
    usage >&2
    exit 1
  fi

  log "Using IMAGE_TAG=${IMAGE_TAG}"
  configure_wasm_registry_defaults
  configure_console_ingress_defaults
  TMP_RELEASE_DIR=$(mktemp -d "${SCRIPT_DIR}/.release-tmp.XXXXXX")

  validate_workflow_manifests
  publish_wasm_images_for_deploy
  verify_platform_images_pullable

  log "Applying K8s resources"
  deploy_foundation
  deploy_egress_path
  deploy_workflow_runtime
  deploy_platform_services
  restart_platform_deployments
  wait_for_rollouts

  log "Done."
}

deploy_addons() {
  local target="${1:-}"

  require_cmd kubectl
  if [ -z "${target}" ]; then
    echo "deploy-addon requires a target." >&2
    usage >&2
    exit 1
  fi

  shift || true
  configure_wasm_registry_defaults
  configure_console_ingress_defaults
  TMP_RELEASE_DIR=$(mktemp -d "${SCRIPT_DIR}/.release-tmp.XXXXXX")

  case "${target}" in
    cluster-addons)
      if [ "$#" -ne 0 ]; then
        echo "cluster-addons does not accept component arguments." >&2
        exit 1
      fi
      deploy_cluster_addons
      ;;
    infrastructure-addons)
      validate_infrastructure_addon_targets "$@"
      if [ "$#" -eq 0 ]; then
        deploy_infrastructure_addons all
      else
        deploy_infrastructure_addons "$@"
      fi
      ;;
    dev-image-infra)
      validate_dev_image_infra_addon_targets "$@"
      if [ "$#" -eq 0 ]; then
        deploy_dev_image_infra all
      else
        deploy_dev_image_infra "$@"
      fi
      ;;
    platform-notifications)
      if [ "$#" -ne 0 ]; then
        echo "platform-notifications does not accept component arguments." >&2
        exit 1
      fi
      deploy_platform_notifications
      ;;
    all)
      if [ "$#" -ne 0 ]; then
        echo "all does not accept component arguments." >&2
        exit 1
      fi
      deploy_cluster_addons
      deploy_infrastructure_addons all
      deploy_platform_notifications
      ;;
    *)
      echo "unsupported addon target: ${target}" >&2
      usage >&2
      exit 1
      ;;
  esac

  log "Done."
}
