#!/bin/sh
set -eu

CLI_OUTPUT_FIFO_PATH="${CLI_OUTPUT_FIFO_PATH:-/run/cli-output/raw/events.fifo}"
CLI_OUTPUT_READY_PATH="${CLI_OUTPUT_READY_PATH:-/run/cli-output/status/ready}"
CLI_OUTPUT_TERMINAL_PATH="${CLI_OUTPUT_TERMINAL_PATH:-/run/cli-output/raw/terminal.json}"
CLI_OUTPUT_STOP_PATH="${CLI_OUTPUT_STOP_PATH:-/run/cli-output/control/stop.json}"
CLI_OUTPUT_WAIT_TIMEOUT_SECONDS="${CLI_OUTPUT_WAIT_TIMEOUT_SECONDS:-30}"

wait_for_cli_output_ready() {
  deadline=$(( $(date +%s) + CLI_OUTPUT_WAIT_TIMEOUT_SECONDS ))
  while [ ! -p "${CLI_OUTPUT_FIFO_PATH}" ] || [ ! -f "${CLI_OUTPUT_READY_PATH}" ]; do
    if [ "$(date +%s)" -ge "${deadline}" ]; then
      echo "cli output sidecar not ready: missing fifo or ready file" >&2
      exit 1
    fi
    sleep 1
  done
}

start_stop_watcher() {
  child_pid="$1"
  (
    while kill -0 "${child_pid}" 2>/dev/null; do
      if [ -f "${CLI_OUTPUT_STOP_PATH}" ]; then
        if grep -q '"force":[[:space:]]*true' "${CLI_OUTPUT_STOP_PATH}" 2>/dev/null; then
          kill -TERM "${child_pid}" 2>/dev/null || true
        else
          kill -INT "${child_pid}" 2>/dev/null || true
        fi
        exit 0
      fi
      sleep 1
    done
  ) &
  CLI_OUTPUT_WATCHER_PID="$!"
}

run_cli_output_stream() {
  wait_for_cli_output_ready
  "$@" >"${CLI_OUTPUT_FIFO_PATH}" 2>&1 &
  child_pid="$!"
  CLI_OUTPUT_WATCHER_PID=""
  start_stop_watcher "${child_pid}"
  watcher_pid="${CLI_OUTPUT_WATCHER_PID}"
  set +e
  wait "${child_pid}"
  status="$?"
  set -e
  kill "${watcher_pid}" 2>/dev/null || true
  wait "${watcher_pid}" 2>/dev/null || true
  mkdir -p "$(dirname "${CLI_OUTPUT_TERMINAL_PATH}")"
  terminal_tmp="$(mktemp "$(dirname "${CLI_OUTPUT_TERMINAL_PATH}")/.terminal.XXXXXX")"
  cat >"${terminal_tmp}" <<EOF
{"exit_code":${status}}
EOF
  chmod 660 "${terminal_tmp}"
  mv "${terminal_tmp}" "${CLI_OUTPUT_TERMINAL_PATH}"
  return "${status}"
}
