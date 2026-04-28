#!/bin/sh
set -eu

# OTEL_COLLECTOR_ENDPOINT is injected via K8s env var (see deployment.yaml).
# Default keeps the standard infra namespace for local/dev convenience.
OTEL_COLLECTOR_ENDPOINT="${OTEL_COLLECTOR_ENDPOINT:-http://otel-collector.code-code-observability.svc.cluster.local:4318}"
otel_collector_endpoint_escaped="$(printf '%s' "${OTEL_COLLECTOR_ENDPOINT}" | sed 's/[&|\]/\\&/g')"

sed "s|OTEL_COLLECTOR_ENDPOINT_PLACEHOLDER|${otel_collector_endpoint_escaped}|g" \
    /etc/nginx/nginx.conf.template > /tmp/nginx.conf

exec nginx -c /tmp/nginx.conf -g 'daemon off;'
