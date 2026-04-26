#!/bin/sh
set -eu

case "${AGENT_PREPARE_JOB_TYPE:-}" in
  auth) ;;
  "")
    echo "missing prepare job type" >&2
    exit 1
    ;;
  *)
    echo "unsupported Claude prepare job type: ${AGENT_PREPARE_JOB_TYPE}" >&2
    exit 1
    ;;
esac

case "${AGENT_RUN_AUTH_MATERIALIZATION_KEY:-}" in
  claude-code.anthropic-api-key) ;;
  "")
    echo "missing Claude auth materialization key" >&2
    exit 1
    ;;
  *)
    echo "unsupported Claude auth materialization key: ${AGENT_RUN_AUTH_MATERIALIZATION_KEY}" >&2
    exit 1
    ;;
esac

if [ -z "${AGENT_RUN_RUNTIME_URL:-}" ]; then
  echo "missing Claude runtime URL" >&2
  exit 1
fi

mkdir -p "${HOME:-/home/node}/.claude"
