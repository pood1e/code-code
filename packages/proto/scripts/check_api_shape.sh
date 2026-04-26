#!/usr/bin/env bash
# check_api_shape.sh — Cross-check management.proto RPC methods against docs.
#
# Usage:
#   cd packages/proto
#   ./scripts/check_api_shape.sh
#
# Exits 0 if consistent, 1 if mismatches are found.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROTO_DIR="${SCRIPT_DIR}/.."
DOCS_DIR="${SCRIPT_DIR}/../../../docs/platform/management-api.md"
PROTO_FILE="${PROTO_DIR}/platform/management/v1/management.proto"

if [ ! -f "$PROTO_FILE" ]; then
  echo "ERROR: proto file not found: $PROTO_FILE"
  exit 1
fi

# Extract RPC method names from proto file.
proto_methods=$(grep '^\s*rpc ' "$PROTO_FILE" | sed 's/.*rpc \([A-Za-z]*\).*/\1/' | sort)

if [ ! -f "$DOCS_DIR" ]; then
  echo "WARN: docs file not found: $DOCS_DIR"
  echo "Skipping docs comparison. Proto methods:"
  echo "$proto_methods"
  exit 0
fi

# Extract method names from docs (assumes lines like "- `MethodName`" or "| MethodName |").
docs_methods=$(grep -oE '\b(List|Get|Create|Update|Delete|Apply|Sync|Start|Complete|Poll|Resolve|Discover)[A-Za-z]+' "$DOCS_DIR" | sort -u)

# Compare.
only_in_proto=$(comm -23 <(echo "$proto_methods") <(echo "$docs_methods"))
only_in_docs=$(comm -13 <(echo "$proto_methods") <(echo "$docs_methods"))

exit_code=0

if [ -n "$only_in_proto" ]; then
  echo "Methods in proto but NOT in docs:"
  echo "$only_in_proto" | sed 's/^/  - /'
  exit_code=1
fi

if [ -n "$only_in_docs" ]; then
  echo "Methods in docs but NOT in proto:"
  echo "$only_in_docs" | sed 's/^/  - /'
  exit_code=1
fi

if [ "$exit_code" -eq 0 ]; then
  echo "OK: proto and docs are consistent ($(echo "$proto_methods" | wc -l | tr -d ' ') methods)"
fi

exit $exit_code
