#!/usr/bin/env bash
# shellcheck disable=SC2016
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "${script_dir}/../.." && pwd)"

kubectl_bin="${KUBECTL:-kubectl}"
jq_bin="${JQ:-jq}"
curl_bin="${CURL:-curl}"
network_namespace="${PLATFORM_EGRESS_SMOKE_NETWORK_NAMESPACE:-code-code-net}"
observability_namespace="${PLATFORM_EGRESS_SMOKE_OBSERVABILITY_NAMESPACE:-code-code-observability}"
workload_namespace="${PLATFORM_EGRESS_SMOKE_WORKLOAD_NAMESPACE:-code-code}"
l7_service_account="${PLATFORM_EGRESS_SMOKE_L7_SERVICE_ACCOUNT:-l7-smoke-client}"
l4_service_account="${PLATFORM_EGRESS_SMOKE_L4_SERVICE_ACCOUNT:-platform-support-service}"
image="${PLATFORM_EGRESS_SMOKE_IMAGE:-busybox:1.36}"
proxy_host="${PLATFORM_EGRESS_SMOKE_PROXY_HOST:-192.168.0.126}"
proxy_port="${PLATFORM_EGRESS_SMOKE_PROXY_PORT:-10809}"
l4_tcp_timeout="${PLATFORM_EGRESS_SMOKE_L4_TCP_TIMEOUT:-20}"
l4_tcp_attempts="${PLATFORM_EGRESS_SMOKE_L4_TCP_ATTEMPTS:-3}"
access_set_id="${PLATFORM_EGRESS_SMOKE_ACCESS_SET_ID:-support.external-rule-set.l7-smoke}"
checks=",${PLATFORM_EGRESS_SMOKE_CHECKS:-l4,proxy,l7-header},"
prometheus_local_port="${PLATFORM_EGRESS_SMOKE_PROMETHEUS_LOCAL_PORT:-19090}"
telemetry_name="${PLATFORM_EGRESS_SMOKE_TELEMETRY_NAME:-code-code-egress-llm-access-logs}"
dynamic_authz_policy_name="${PLATFORM_EGRESS_SMOKE_DYNAMIC_AUTHZ_POLICY:-}"
dynamic_authz_provider="${PLATFORM_EGRESS_SMOKE_DYNAMIC_AUTHZ_PROVIDER:-code-code-egress-auth-bearer}"
pod_prefix="${PLATFORM_EGRESS_SMOKE_POD_PREFIX:-code-code-egress-smoke}"
run_id="$(date +%s)"
l4_pod="${pod_prefix}-l4-${run_id}"
proxy_pod="${pod_prefix}-proxy-${run_id}"
l7_request_pod="${pod_prefix}-l7-req-${run_id}"
l7_response_pod="${pod_prefix}-l7-resp-${run_id}"
telemetry_pod="${pod_prefix}-telemetry-${run_id}"
created_l7_service_account=""
prometheus_pf_pid=""
prometheus_pf_log=""

cleanup() {
  "${kubectl_bin}" -n "${workload_namespace}" delete pod "${l4_pod}" "${proxy_pod}" "${l7_request_pod}" "${l7_response_pod}" "${telemetry_pod}" --ignore-not-found >/dev/null 2>&1 || true
  if [[ -n "${created_l7_service_account}" ]]; then
    "${kubectl_bin}" -n "${workload_namespace}" delete serviceaccount "${l7_service_account}" --ignore-not-found >/dev/null 2>&1 || true
  fi
  if [[ -n "${prometheus_pf_pid}" ]]; then
    kill "${prometheus_pf_pid}" >/dev/null 2>&1 || true
    wait "${prometheus_pf_pid}" >/dev/null 2>&1 || true
  fi
  if [[ -n "${prometheus_pf_log}" ]]; then
    rm -f "${prometheus_pf_log}"
  fi
  PLATFORM_EGRESS_SMOKE_MODE=delete "${repo_root}/deploy/scripts/egress-access-set-smoke.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

require_tool() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "[egress-data-plane-smoke] missing required tool: $1" >&2
    exit 1
  fi
}

has_check() {
  [[ "${checks}" == *",$1,"* ]]
}

requires_l7_access_set() {
  has_check l7-header || has_check l7-request-header || has_check l7-response-header || has_check l7-telemetry || has_check dynamic-authz
}

resource_names_for_access_set() {
  local kind="$1"
  "${kubectl_bin}" -n "${network_namespace}" get "${kind}" -o json | "${jq_bin}" -r \
    --arg access_set_id "${access_set_id}" \
    '.items[] | select((.metadata.annotations["egress.platform.code-code.internal/access-set-id"] // "") | contains($access_set_id)) | .metadata.name'
}

wait_for_route_accepted() {
  local kind="$1"
  local name="$2"
  for _ in $(seq 1 60); do
    local accepted
    accepted="$("${kubectl_bin}" -n "${network_namespace}" get "${kind}" "${name}" -o json | "${jq_bin}" -r '[.status.parents[]?.conditions[]? | select(.type == "Accepted" and .status == "True")] | length')"
    if [[ "${accepted}" != "0" ]]; then
      return 0
    fi
    sleep 1
  done
  "${kubectl_bin}" -n "${network_namespace}" get "${kind}" "${name}" -o yaml >&2
  echo "[egress-data-plane-smoke] ${kind}/${name} was not accepted" >&2
  exit 1
}

wait_for_gateway_ready() {
  local gateway="$1"
  local service_name="${gateway}-istio"
  for _ in $(seq 1 120); do
    local programmed
    programmed="$("${kubectl_bin}" -n "${network_namespace}" get gateway "${gateway}" -o json | "${jq_bin}" -r '[.status.conditions[]? | select(.type == "Programmed" and .status == "True")] | length')"
    if [[ "${programmed}" != "0" ]]; then
      return 0
    fi
    local listener_programmed
    listener_programmed="$("${kubectl_bin}" -n "${network_namespace}" get gateway "${gateway}" -o json | "${jq_bin}" -r '[.status.listeners[]?.conditions[]? | select(.type == "Programmed" and .status == "True")] | length')"
    local ready_endpoints
    ready_endpoints="$("${kubectl_bin}" -n "${network_namespace}" get endpointslice -l "kubernetes.io/service-name=${service_name}" -o json 2>/dev/null | "${jq_bin}" -r '[.items[]?.endpoints[]? | select((.conditions.ready // false) == true)] | length' || true)"
    if [[ "${listener_programmed}" != "0" && "${ready_endpoints}" != "" && "${ready_endpoints}" != "0" ]]; then
      return 0
    fi
    sleep 1
  done
  "${kubectl_bin}" -n "${network_namespace}" get gateway "${gateway}" -o yaml >&2 || true
  "${kubectl_bin}" -n "${network_namespace}" get endpointslice -l "kubernetes.io/service-name=${service_name}" -o yaml >&2 || true
  echo "[egress-data-plane-smoke] gateway/${gateway} was not ready" >&2
  exit 1
}

wait_for_telemetry_target() {
  local gateway="$1"
  for _ in $(seq 1 90); do
    local matched
    matched="$("${kubectl_bin}" -n "${network_namespace}" get telemetry "${telemetry_name}" -o json 2>/dev/null | "${jq_bin}" -r --arg gateway "${gateway}" '[.spec.targetRefs[]? | select(.group == "gateway.networking.k8s.io" and .kind == "Gateway" and .name == $gateway)] | length' || true)"
    if [[ "${matched}" != "" && "${matched}" != "0" ]]; then
      return 0
    fi
    sleep 2
  done
  "${kubectl_bin}" -n "${network_namespace}" get telemetry "${telemetry_name}" -o yaml >&2 || true
  echo "[egress-data-plane-smoke] telemetry/${telemetry_name} did not target gateway/${gateway}" >&2
  exit 1
}

start_prometheus_port_forward() {
  if [[ -n "${prometheus_pf_pid}" ]]; then
    return
  fi
  require_tool "${curl_bin}"
  prometheus_pf_log="$(mktemp)"
  "${kubectl_bin}" -n "${observability_namespace}" port-forward --address 127.0.0.1 svc/prometheus "${prometheus_local_port}:9090" >"${prometheus_pf_log}" 2>&1 &
  prometheus_pf_pid="$!"
  for _ in $(seq 1 30); do
    if "${curl_bin}" -fsS "http://127.0.0.1:${prometheus_local_port}/-/ready" >/dev/null 2>&1; then
      return
    fi
    if ! kill -0 "${prometheus_pf_pid}" >/dev/null 2>&1; then
      cat "${prometheus_pf_log}" >&2 || true
      exit 1
    fi
    sleep 1
  done
  cat "${prometheus_pf_log}" >&2 || true
  echo "[egress-data-plane-smoke] prometheus port-forward did not become ready" >&2
  exit 1
}

wait_for_prometheus_metric() {
  local query="$1"
  start_prometheus_port_forward
  for _ in $(seq 1 90); do
    local count
    count="$("${curl_bin}" -fsS -G --data-urlencode "query=${query}" "http://127.0.0.1:${prometheus_local_port}/api/v1/query" | "${jq_bin}" -r '.data.result | length')"
    if [[ "${count}" != "0" ]]; then
      echo "[egress-data-plane-smoke] prometheus query matched ${count}: ${query}"
      return 0
    fi
    sleep 2
  done
  "${curl_bin}" -fsS -G --data-urlencode "query={__name__=~\"gen_ai_provider_runtime_.*\"}" "http://127.0.0.1:${prometheus_local_port}/api/v1/query" | "${jq_bin}" '.data.result' >&2 || true
  echo "[egress-data-plane-smoke] prometheus query did not match: ${query}" >&2
  exit 1
}

require_dynamic_authz_policy() {
  local policy_name="${dynamic_authz_policy_name}"
  if [[ -z "${policy_name}" ]]; then
    mapfile -t authz_policies < <(resource_names_for_access_set authorizationpolicy)
    for candidate in "${authz_policies[@]}"; do
      local candidate_provider
      candidate_provider="$("${kubectl_bin}" -n "${network_namespace}" get authorizationpolicy "${candidate}" -o json | "${jq_bin}" -r '.spec.provider.name // ""')"
      if [[ "${candidate_provider}" == "${dynamic_authz_provider}" ]]; then
        policy_name="${candidate}"
        break
      fi
    done
  fi
  if [[ -z "${policy_name}" ]]; then
    "${kubectl_bin}" -n "${network_namespace}" get authorizationpolicy -l egress.platform.code-code.internal/role=dynamic-header-authz -o yaml >&2 || true
    echo "[egress-data-plane-smoke] dynamic authz policy for provider ${dynamic_authz_provider} was not found" >&2
    exit 1
  fi
  local provider
  provider="$("${kubectl_bin}" -n "${network_namespace}" get authorizationpolicy "${policy_name}" -o json | "${jq_bin}" -r '.spec.provider.name // ""')"
  if [[ "${provider}" != "${dynamic_authz_provider}" ]]; then
    "${kubectl_bin}" -n "${network_namespace}" get authorizationpolicy "${policy_name}" -o yaml >&2 || true
    echo "[egress-data-plane-smoke] dynamic authz provider = ${provider}, want ${dynamic_authz_provider}" >&2
    exit 1
  fi
  local target_count
  target_count="$("${kubectl_bin}" -n "${network_namespace}" get authorizationpolicy "${policy_name}" -o json | "${jq_bin}" -r '[.spec.targetRefs[]? | select(.group == "networking.istio.io" and .kind == "ServiceEntry")] | length')"
  if [[ "${target_count}" == "0" ]]; then
    "${kubectl_bin}" -n "${network_namespace}" get authorizationpolicy "${policy_name}" -o yaml >&2 || true
    echo "[egress-data-plane-smoke] dynamic authz policy has no ServiceEntry targetRefs" >&2
    exit 1
  fi
  echo "[egress-data-plane-smoke] ${policy_name} targets ${target_count} ServiceEntry resource(s)"
}

run_smoke_pod() {
  local pod_name="$1"
  local service_account="$2"
  local command="$3"

  cat <<YAML | "${kubectl_bin}" apply -f - >/dev/null
apiVersion: v1
kind: Pod
metadata:
  name: ${pod_name}
  namespace: ${workload_namespace}
  labels:
    app.kubernetes.io/name: code-code-egress-smoke
    code-code.internal/runtime: agent-run
spec:
  restartPolicy: Never
  serviceAccountName: ${service_account}
  automountServiceAccountToken: false
  securityContext:
    runAsNonRoot: true
    runAsUser: 65532
    runAsGroup: 65532
    seccompProfile:
      type: RuntimeDefault
  containers:
    - name: smoke
      image: ${image}
      imagePullPolicy: IfNotPresent
      securityContext:
        allowPrivilegeEscalation: false
        capabilities:
          drop:
            - ALL
      resources:
        requests:
          cpu: 10m
          memory: 16Mi
          ephemeral-storage: 16Mi
        limits:
          cpu: 50m
          memory: 32Mi
          ephemeral-storage: 64Mi
      command:
        - sh
        - -c
        - |
$(printf '%s\n' "${command}" | sed 's/^/          /')
YAML

  local phase=""
  for _ in $(seq 1 180); do
    phase="$("${kubectl_bin}" -n "${workload_namespace}" get pod "${pod_name}" -o jsonpath='{.status.phase}' 2>/dev/null || true)"
    case "${phase}" in
      Succeeded)
        break
        ;;
      Failed)
        "${kubectl_bin}" -n "${workload_namespace}" logs "${pod_name}" >&2 || true
        "${kubectl_bin}" -n "${workload_namespace}" describe pod "${pod_name}" >&2 || true
        exit 1
        ;;
    esac
    sleep 1
  done
  if [[ "${phase}" != "Succeeded" ]]; then
    "${kubectl_bin}" -n "${workload_namespace}" logs "${pod_name}" >&2 || true
    "${kubectl_bin}" -n "${workload_namespace}" describe pod "${pod_name}" >&2 || true
    exit 1
  fi
  "${kubectl_bin}" -n "${workload_namespace}" logs "${pod_name}"
}

require_tool "${kubectl_bin}"
require_tool "${jq_bin}"

gateways=()
if requires_l7_access_set; then
  echo "[egress-data-plane-smoke] applying L7 smoke access set ${access_set_id}"
  PLATFORM_EGRESS_SMOKE_MODE=apply "${repo_root}/deploy/scripts/egress-access-set-smoke.sh"

  mapfile -t gateways < <(resource_names_for_access_set gateway)
  mapfile -t http_routes < <(resource_names_for_access_set httproute)
  mapfile -t destination_rules < <(resource_names_for_access_set destinationrule)

  if [[ "${#gateways[@]}" -lt 1 || "${#http_routes[@]}" -lt 2 || "${#destination_rules[@]}" -lt 2 ]]; then
    "${kubectl_bin}" -n "${network_namespace}" get gateway,httproute,destinationrule,serviceentry,authorizationpolicy
    echo "[egress-data-plane-smoke] generated L7 resources are incomplete" >&2
    exit 1
  fi

  for gateway in "${gateways[@]}"; do
    wait_for_gateway_ready "${gateway}"
  done
  for route in "${http_routes[@]}"; do
    wait_for_route_accepted httproute "${route}"
  done

  echo "[egress-data-plane-smoke] ensuring ${workload_namespace}/${l7_service_account} service account"
  if ! "${kubectl_bin}" -n "${workload_namespace}" get serviceaccount "${l7_service_account}" >/dev/null 2>&1; then
    "${kubectl_bin}" -n "${workload_namespace}" create serviceaccount "${l7_service_account}" >/dev/null
    created_l7_service_account="true"
  fi
fi

if has_check l4; then
  echo "[egress-data-plane-smoke] L4 direct TLS reachability smoke"
  run_smoke_pod "${l4_pod}" "${l4_service_account}" "set -eu
attempt=1
while [ \"\${attempt}\" -le ${l4_tcp_attempts} ]; do
  echo \"[l4] raw.githubusercontent.com:443 attempt \${attempt}/${l4_tcp_attempts}\"
  if nc -vz -w ${l4_tcp_timeout} raw.githubusercontent.com 443; then
    echo \"[l4] raw.githubusercontent.com:443 ok\"
    exit 0
  fi
  attempt=\$((attempt + 1))
  sleep 2
done
echo \"[l4] raw.githubusercontent.com:443 failed after ${l4_tcp_attempts} attempts\" >&2
exit 1"
fi

if has_check proxy; then
  echo "[egress-data-plane-smoke] preset proxy TCP smoke"
  run_smoke_pod "${proxy_pod}" "${l4_service_account}" "set -eu
nc -vz -w 5 ${proxy_host} ${proxy_port}
echo \"[proxy] ${proxy_host}:${proxy_port} ok\""
fi

if has_check dynamic-authz; then
  require_dynamic_authz_policy
fi

if has_check l7-header || has_check l7-request-header; then
  echo "[egress-data-plane-smoke] L7 request header rewrite smoke"
  run_smoke_pod "${l7_request_pod}" "${l7_service_account}" 'set -eu
body="$(wget -qO- --timeout=30 --tries=1 --header="X-Code-Code-Debug-Remove: remove-me" http://httpbin.org/headers)"
printf "%s\n" "${body}"
printf "%s\n" "${body}" | grep -q "X-Code-Code-L7-Smoke"
printf "%s\n" "${body}" | grep -q "enabled"
if printf "%s\n" "${body}" | grep -q "X-Code-Code-Debug-Remove"; then
  echo "[l7] removed header leaked" >&2
  exit 1
fi
echo "[l7] httpbin request header rewrite ok"'
fi

if has_check l7-header || has_check l7-response-header; then
  echo "[egress-data-plane-smoke] L7 response header rewrite smoke"
  run_smoke_pod "${l7_response_pod}" "${l7_service_account}" 'set -eu
url="http://httpbin.org/response-headers?X-Code-Code-Response-Debug=remove-me&x-ratelimit-limit-requests=100&x-ratelimit-remaining-requests=42&retry-after=3"
headers="$(wget -S -O /tmp/l7-response-body --timeout=30 --tries=1 "${url}" 2>&1)"
printf "%s\n" "${headers}"
printf "%s\n" "${headers}" | grep -qi "X-Code-Code-L7-Response: enabled"
if printf "%s\n" "${headers}" | grep -qi "X-Code-Code-Response-Debug"; then
  echo "[l7] removed response header leaked" >&2
  exit 1
fi
echo "[l7] httpbin response header rewrite ok"'
fi

if has_check l7-telemetry; then
  if [[ "${#gateways[@]}" -lt 1 ]]; then
    echo "[egress-data-plane-smoke] L7 telemetry requires an applied L7 access set" >&2
    exit 1
  fi
  wait_for_telemetry_target "${gateways[0]}"
  echo "[egress-data-plane-smoke] L7 header telemetry smoke"
  run_smoke_pod "${telemetry_pod}" "${l7_service_account}" 'set -eu
url="http://httpbin.org/response-headers?x-ratelimit-limit-requests=100&x-ratelimit-remaining-requests=42&retry-after=3"
for attempt in 1 2 3; do
  wget -qO- --timeout=30 --tries=1 --header="X-Code-Code-Provider-ID: smoke-provider" --header="X-Code-Code-Model-ID: smoke-model" "${url}" >/tmp/l7-telemetry-body
  if [ "${attempt}" = "1" ]; then
    cat /tmp/l7-telemetry-body
  fi
  echo "[l7] telemetry source request ${attempt}/3 ok"
  if [ "${attempt}" != "3" ]; then
    sleep 15
  fi
done'
  wait_for_prometheus_metric 'gen_ai_provider_runtime_rate_limit_limit{resource="requests"}'
  wait_for_prometheus_metric 'gen_ai_provider_runtime_rate_limit_remaining{resource="requests"}'
  wait_for_prometheus_metric 'gen_ai_provider_runtime_retry_after_seconds'
fi

echo "[egress-data-plane-smoke] ok"
