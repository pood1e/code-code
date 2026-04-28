#!/usr/bin/env bash
# shellcheck disable=SC2016
set -euo pipefail

curl_bin="${CURL:-curl}"
jq_bin="${JQ:-jq}"
kubectl_bin="${KUBECTL:-kubectl}"
istioctl_bin="${ISTIOCTL:-istioctl}"

console_route_namespace="${CONSOLE_ROUTE_NAMESPACE:-code-code-console}"
showcase_route_namespace="${SHOWCASE_ROUTE_NAMESPACE:-code-code-showcase}"
observability_route_namespace="${OBSERVABILITY_ROUTE_NAMESPACE:-code-code-observability}"
platform_gateway_namespace="${PLATFORM_GATEWAY_NAMESPACE:-code-code-net}"
platform_gateway_name="${PLATFORM_GATEWAY_NAME:-platform-ingress}"

console_url="${CONSOLE_URL:-http://console.192.168.0.126.nip.io:30599/}"
showcase_url="${SHOWCASE_URL:-http://showcase.192.168.0.126.nip.io:30599/}"
grafana_url="${GRAFANA_URL:-http://grafana.192.168.0.126.nip.io:30599/login}"
kiali_url="${KIALI_URL:-http://kiali.192.168.0.126.nip.io:30599/}"
kiali_base_url="${KIALI_BASE_URL:-http://kiali.192.168.0.126.nip.io:30599}"
analyze_namespaces="${ANALYZE_NAMESPACES:-code-code code-code-net code-code-console code-code-showcase code-code-observability}"

require_tool() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "[smoke-ingress] missing required tool: $1" >&2
    exit 1
  fi
}

check_url() {
  local name="$1"
  local url="$2"
  local code

  code="$("${curl_bin}" -sS -o /dev/null -w '%{http_code}' "${url}")"
  printf '[smoke-ingress] %s %s -> %s\n' "${name}" "${url}" "${code}"
  if [[ "${code}" != "200" ]]; then
    exit 1
  fi
}

check_route() {
  local namespace="$1"
  local name="$2"
  local matched

  "${kubectl_bin}" get httproute -n "${namespace}" "${name}" >/dev/null
  matched="$("${kubectl_bin}" get httproute -n "${namespace}" "${name}" -o json | "${jq_bin}" -r \
    --arg gateway_namespace "${platform_gateway_namespace}" \
    --arg gateway_name "${platform_gateway_name}" \
    '[.status.parents[]?
      | select(.parentRef.namespace == $gateway_namespace and .parentRef.name == $gateway_name)
      | .conditions[]
      | select((.type == "Accepted" or .type == "ResolvedRefs" or .type == "ResolvedWaypoints") and .status == "True")]
     | length')"
  printf '[smoke-ingress] route %s/%s true conditions=%s\n' "${namespace}" "${name}" "${matched}"
  if [[ "${matched}" -lt 3 ]]; then
    "${kubectl_bin}" get httproute -n "${namespace}" "${name}" -o json | "${jq_bin}" '.status.parents'
    exit 1
  fi
}

check_kiali_namespace() {
  local namespace="$1"
  local body errors warnings

  body="$("${curl_bin}" -sS "${kiali_base_url}/api/namespaces/${namespace}/validations")"
  errors="$(printf '%s' "${body}" | "${jq_bin}" -r '.errors')"
  warnings="$(printf '%s' "${body}" | "${jq_bin}" -r '.warnings')"
  printf '[smoke-ingress] kiali %s errors=%s warnings=%s\n' "${namespace}" "${errors}" "${warnings}"
  if [[ "${errors}" != "0" || "${warnings}" != "0" ]]; then
    printf '%s\n' "${body}"
    exit 1
  fi
}

require_tool "${curl_bin}"
require_tool "${jq_bin}"
require_tool "${kubectl_bin}"
require_tool "${istioctl_bin}"

check_url console "${console_url}"
check_url showcase "${showcase_url}"
check_url grafana "${grafana_url}"
check_url kiali "${kiali_url}"

check_route "${console_route_namespace}" console
check_route "${showcase_route_namespace}" showcase
check_route "${observability_route_namespace}" grafana
check_route "${observability_route_namespace}" kiali

check_kiali_namespace "${console_route_namespace}"
check_kiali_namespace "${showcase_route_namespace}"

for namespace in ${analyze_namespaces}; do
  printf '[smoke-ingress] istio analyze %s\n' "${namespace}"
  "${istioctl_bin}" analyze -n "${namespace}"
done
