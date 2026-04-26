#!/bin/sh
set -eu

. /usr/local/bin/cli-output-runtime.sh

QWEN_PROMPT="${QWEN_PROMPT:-${AGENT_RUN_PROMPT:-Reply with exactly OK}}"
QWEN_MODEL="${QWEN_MODEL:-${AGENT_RUN_MODEL:-}}"
QWEN_MODEL_FILE="${QWEN_MODEL_FILE:-/run/cli-runtime/model}"
QWEN_BASE_URL="${QWEN_BASE_URL:-${AGENT_RUN_RUNTIME_URL:-}}"
QWEN_AUTH_MATERIALIZATION_KEY="${QWEN_AUTH_MATERIALIZATION_KEY:-${AGENT_RUN_AUTH_MATERIALIZATION_KEY:-}}"
QWEN_BASE_URL_FILE="${QWEN_BASE_URL_FILE:-/run/cli-runtime/base_url}"
QWEN_PLACEHOLDER_VALUE="${QWEN_PLACEHOLDER_VALUE:-PLACEHOLDER}"
QWEN_API_KEY_ENV_NAME="${QWEN_API_KEY_ENV_NAME:-QWEN_PLACEHOLDER_API_KEY}"
QWEN_CLI_BIN="${QWEN_CLI_BIN:-qwen}"
QWEN_CONFIGURE_SCRIPT="${QWEN_CONFIGURE_SCRIPT:-/usr/local/lib/qwen-cli/configure-qwen.js}"

if [ -z "${QWEN_MODEL}" ] && [ -f "${QWEN_MODEL_FILE}" ]; then
  QWEN_MODEL="$(tr -d '\r' <"${QWEN_MODEL_FILE}")"
fi

case "${QWEN_AUTH_MATERIALIZATION_KEY}" in
  qwen-cli.openai-compatible-api-key) ;;
  "")
    echo "missing Qwen auth materialization key" >&2
    exit 1
    ;;
  *)
    echo "unsupported Qwen auth materialization key: ${QWEN_AUTH_MATERIALIZATION_KEY}" >&2
    exit 1
    ;;
esac

export QWEN_MODEL
export QWEN_BASE_URL
export QWEN_AUTH_MATERIALIZATION_KEY
export QWEN_BASE_URL_FILE
export QWEN_PLACEHOLDER_VALUE
export QWEN_API_KEY_ENV_NAME

node "${QWEN_CONFIGURE_SCRIPT}"

set -- "${QWEN_CLI_BIN}" \
  -o stream-json \
  --include-partial-messages \
  --chat-recording \
  --approval-mode yolo \
  --channel CI \
  "${QWEN_PROMPT}"

run_cli_output_stream "$@"
