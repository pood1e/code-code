#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "${script_dir}/../.." && pwd)"

kubectl_bin="${KUBECTL:-kubectl}"
go_bin="${GO:-go}"
namespace="${PLATFORM_EGRESS_SMOKE_NAMESPACE:-code-code-net}"
service="${PLATFORM_EGRESS_SMOKE_SERVICE:-platform-egress-service}"
service_port="${PLATFORM_EGRESS_SMOKE_SERVICE_PORT:-8081}"
local_port="${PLATFORM_EGRESS_SMOKE_LOCAL_PORT:-18081}"
mode="${PLATFORM_EGRESS_SMOKE_MODE:-lifecycle}"

pf_pid=""
pf_log="$(mktemp)"

cleanup() {
  if [[ -n "${pf_pid}" ]]; then
    kill "${pf_pid}" >/dev/null 2>&1 || true
    wait "${pf_pid}" >/dev/null 2>&1 || true
  fi
  rm -f "${pf_log}"
}
trap cleanup EXIT

require_tool() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "[egress-smoke] missing required tool: $1" >&2
    exit 1
  fi
}

require_tool "${go_bin}"

if [[ -z "${PLATFORM_EGRESS_SMOKE_GRPC_ADDR:-}" ]]; then
  require_tool "${kubectl_bin}"
  echo "[egress-smoke] port-forward svc/${service}.${namespace} ${local_port}:${service_port}"
  "${kubectl_bin}" -n "${namespace}" port-forward --address 127.0.0.1 "svc/${service}" "${local_port}:${service_port}" >"${pf_log}" 2>&1 &
  pf_pid="$!"

  ready=""
  for _ in $(seq 1 30); do
    if (echo >"/dev/tcp/127.0.0.1/${local_port}") >/dev/null 2>&1; then
      ready="true"
      break
    fi
    if ! kill -0 "${pf_pid}" >/dev/null 2>&1; then
      cat "${pf_log}" >&2 || true
      exit 1
    fi
    sleep 1
  done
  if [[ -z "${ready}" ]]; then
    cat "${pf_log}" >&2 || true
    echo "[egress-smoke] port-forward did not become ready" >&2
    exit 1
  fi
  export PLATFORM_EGRESS_SMOKE_GRPC_ADDR="127.0.0.1:${local_port}"
fi

echo "[egress-smoke] running control-plane access-set ${mode} smoke"
(
  cd "${repo_root}/packages/platform-k8s"
  "${go_bin}" run ./cmd/platform-egress-smoke-test
)
echo "[egress-smoke] ok"
