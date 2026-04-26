#!/bin/sh
set -eu

case "${AGENT_PREPARE_JOB_TYPE:-}" in
  auth) ;;
  "")
    echo "missing prepare job type" >&2
    exit 1
    ;;
  *)
    echo "unsupported Gemini prepare job type: ${AGENT_PREPARE_JOB_TYPE}" >&2
    exit 1
    ;;
esac

case "${AGENT_RUN_AUTH_MATERIALIZATION_KEY:-}" in
  gemini-cli.google-oauth) ;;
  "")
    echo "missing Gemini auth materialization key" >&2
    exit 1
    ;;
  *)
    echo "unsupported Gemini auth materialization key: ${AGENT_RUN_AUTH_MATERIALIZATION_KEY}" >&2
    exit 1
    ;;
esac

mkdir -p "${HOME:-/home/node}"
