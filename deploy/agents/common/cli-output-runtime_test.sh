#!/bin/sh
set -eu

script_dir="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
tmpdir="$(mktemp -d)"

cleanup() {
  if [ -n "${reader_pid:-}" ]; then
    kill "${reader_pid}" 2>/dev/null || true
    wait "${reader_pid}" 2>/dev/null || true
  fi
  rm -rf "${tmpdir}"
}

trap cleanup EXIT INT TERM

mkdir -p \
  "${tmpdir}/run/cli-output/raw" \
  "${tmpdir}/run/cli-output/status" \
  "${tmpdir}/run/cli-output/control"
mkfifo "${tmpdir}/run/cli-output/raw/events.fifo"
: >"${tmpdir}/run/cli-output/status/ready"

cat "${tmpdir}/run/cli-output/raw/events.fifo" >"${tmpdir}/fifo.out" &
reader_pid="$!"

CLI_OUTPUT_FIFO_PATH="${tmpdir}/run/cli-output/raw/events.fifo" \
CLI_OUTPUT_READY_PATH="${tmpdir}/run/cli-output/status/ready" \
CLI_OUTPUT_TERMINAL_PATH="${tmpdir}/run/cli-output/raw/terminal.json" \
CLI_OUTPUT_STOP_PATH="${tmpdir}/run/cli-output/control/stop.json" \
/bin/sh -eu -c ". '${script_dir}/cli-output-runtime.sh'; run_cli_output_stream sh -c 'printf pong'"

if [ ! -f "${tmpdir}/run/cli-output/raw/terminal.json" ]; then
  echo "missing terminal.json" >&2
  exit 1
fi

if ! grep -q '"exit_code":0' "${tmpdir}/run/cli-output/raw/terminal.json"; then
  echo "unexpected terminal result" >&2
  cat "${tmpdir}/run/cli-output/raw/terminal.json" >&2
  exit 1
fi

if [ "$(cat "${tmpdir}/fifo.out")" != "pong" ]; then
  echo "unexpected fifo output" >&2
  cat "${tmpdir}/fifo.out" >&2
  exit 1
fi
