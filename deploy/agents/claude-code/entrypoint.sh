#!/bin/sh
set -eu

. /usr/local/bin/cli-output-runtime.sh

CLAUDE_PROMPT="${CLAUDE_PROMPT:-${AGENT_RUN_PROMPT:-Reply with exactly OK}}"
CLAUDE_EXPECT_TEXT="${CLAUDE_EXPECT_TEXT:-OK}"
CLAUDE_MODEL="${CLAUDE_MODEL:-${AGENT_RUN_MODEL:-}}"
CLAUDE_BASE_URL="${CLAUDE_BASE_URL:-${AGENT_RUN_RUNTIME_URL:-}}"
CLAUDE_AUTH_MATERIALIZATION_KEY="${CLAUDE_AUTH_MATERIALIZATION_KEY:-${AGENT_RUN_AUTH_MATERIALIZATION_KEY:-}}"
CLAUDE_BASE_URL_FILE="${CLAUDE_BASE_URL_FILE:-/run/cli-runtime/base_url}"
CLAUDE_HOME_DIR="${CLAUDE_HOME_DIR:-${HOME}/.claude}"
CLAUDE_PLACEHOLDER_VALUE="${CLAUDE_PLACEHOLDER_VALUE:-PLACEHOLDER}"

if [ -z "${CLAUDE_BASE_URL}" ] && [ -f "${CLAUDE_BASE_URL_FILE}" ]; then
  CLAUDE_BASE_URL="$(tr -d '\r' <"${CLAUDE_BASE_URL_FILE}")"
fi

case "${CLAUDE_AUTH_MATERIALIZATION_KEY}" in
  claude-code.anthropic-api-key) ;;
  "")
    echo "missing Claude auth materialization key" >&2
    exit 1
    ;;
  *)
    echo "unsupported Claude auth materialization key: ${CLAUDE_AUTH_MATERIALIZATION_KEY}" >&2
    exit 1
    ;;
esac

if [ -z "${CLAUDE_BASE_URL}" ]; then
  echo "missing Claude base URL: set CLAUDE_BASE_URL or mount ${CLAUDE_BASE_URL_FILE}" >&2
  exit 1
fi

if [ -z "${CLAUDE_MODEL}" ]; then
  echo "missing Claude model: set CLAUDE_MODEL" >&2
  exit 1
fi

mkdir -p "${CLAUDE_HOME_DIR}"
export CLI_CREDENTIAL_VALUE="${CLAUDE_PLACEHOLDER_VALUE}"

cat >"${CLAUDE_HOME_DIR}/settings.json" <<'EOF'
{
  "$schema": "https://json.schemastore.org/claude-code-settings.json",
  "apiKeyHelper": "/usr/local/bin/claude-auth-helper.sh"
}
EOF

export ANTHROPIC_BASE_URL="${CLAUDE_BASE_URL}"

run_cli_output_stream claude \
  -p \
  --output-format stream-json \
  --verbose \
  --include-partial-messages \
  --permission-mode bypassPermissions \
  --model "${CLAUDE_MODEL}" \
  "${CLAUDE_PROMPT}"
