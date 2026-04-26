#!/bin/sh
set -eu

case "${AGENT_PREPARE_JOB_TYPE:-}" in
  auth) ;;
  "")
    echo "missing prepare job type" >&2
    exit 1
    ;;
  *)
    echo "unsupported Qwen prepare job type: ${AGENT_PREPARE_JOB_TYPE}" >&2
    exit 1
    ;;
esac

case "${AGENT_RUN_AUTH_MATERIALIZATION_KEY:-}" in
  qwen-cli.openai-compatible-api-key) ;;
  "")
    echo "missing Qwen auth materialization key" >&2
    exit 1
    ;;
  *)
    echo "unsupported Qwen auth materialization key: ${AGENT_RUN_AUTH_MATERIALIZATION_KEY}" >&2
    exit 1
    ;;
esac

if [ -z "${AGENT_RUN_RUNTIME_URL:-}" ]; then
  echo "missing Qwen runtime URL" >&2
  exit 1
fi

mkdir -p "${HOME:-/home/node}"
