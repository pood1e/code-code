#!/bin/sh
set -eu

CLI_CREDENTIAL_VALUE="${CLI_CREDENTIAL_VALUE:-}"
CLI_CREDENTIAL_FILE_PATH="${CLI_CREDENTIAL_FILE_PATH:-/run/cli-credential/token}"

if [ -n "${CLI_CREDENTIAL_VALUE}" ]; then
  printf '%s' "${CLI_CREDENTIAL_VALUE}"
  exit 0
fi

if [ ! -f "${CLI_CREDENTIAL_FILE_PATH}" ]; then
  echo "missing credential file: ${CLI_CREDENTIAL_FILE_PATH}" >&2
  exit 1
fi

tr -d '\r' <"${CLI_CREDENTIAL_FILE_PATH}"
