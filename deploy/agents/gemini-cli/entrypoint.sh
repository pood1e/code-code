#!/bin/sh
set -eu

. /usr/local/bin/cli-output-runtime.sh

GEMINI_PROMPT="${GEMINI_PROMPT:-${AGENT_RUN_PROMPT:-Reply with exactly OK}}"
GEMINI_MODEL="${GEMINI_MODEL:-${AGENT_RUN_MODEL:-}}"
GEMINI_MODEL_FILE="${GEMINI_MODEL_FILE:-/run/cli-runtime/model}"
GEMINI_CLI_BIN="${GEMINI_CLI_BIN:-gemini}"
GEMINI_CONFIGURE_SCRIPT="${GEMINI_CONFIGURE_SCRIPT:-/usr/local/lib/gemini-cli/configure-gemini.js}"
GEMINI_AUTH_MATERIALIZATION_KEY="${GEMINI_AUTH_MATERIALIZATION_KEY:-${AGENT_RUN_AUTH_MATERIALIZATION_KEY:-}}"

load_optional_file_value() {
  value="$1"
  file_path="$2"
  if [ -n "${value}" ] || [ ! -f "${file_path}" ]; then
    printf '%s' "${value}"
    return
  fi
  tr -d '\r' <"${file_path}"
}

export GOOGLE_GENAI_USE_GCA=true

case "${GEMINI_AUTH_MATERIALIZATION_KEY}" in
  gemini-cli.google-oauth) ;;
  "")
    echo "missing Gemini auth materialization key" >&2
    exit 1
    ;;
  *)
    echo "unsupported Gemini auth materialization key: ${GEMINI_AUTH_MATERIALIZATION_KEY}" >&2
    exit 1
    ;;
esac

GEMINI_MODEL="$(load_optional_file_value "${GEMINI_MODEL}" "${GEMINI_MODEL_FILE}")"

node "${GEMINI_CONFIGURE_SCRIPT}"

set -- "${GEMINI_CLI_BIN}" --prompt "${GEMINI_PROMPT}" --output-format stream-json

if [ -n "${GEMINI_MODEL}" ]; then
  set -- "$@" --model "${GEMINI_MODEL}"
fi

run_cli_output_stream "$@"
