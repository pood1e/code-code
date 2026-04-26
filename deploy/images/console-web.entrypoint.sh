#!/bin/sh
set -eu

# OTEL_COLLECTOR_ENDPOINT is injected via K8s env var (see deployment.yaml).
# Default keeps the standard infra namespace for local/dev convenience.
OTEL_COLLECTOR_ENDPOINT="${OTEL_COLLECTOR_ENDPOINT:-http://otel-collector.code-code-observability.svc.cluster.local:4318}"

sed "s|OTEL_COLLECTOR_ENDPOINT_PLACEHOLDER|${OTEL_COLLECTOR_ENDPOINT}|g" \
    /etc/nginx/nginx.conf.template > /tmp/nginx.conf

exec nginx -c /tmp/nginx.conf -g 'daemon off;'
