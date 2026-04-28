# Notification Dispatcher

## responsibility

Notification dispatch is owned by the `notification-dispatcher` service and Apprise API.

`notification-dispatcher` consumes platform notification events from NATS JetStream, maps event fields into a provider-neutral HTTP payload, retries failed delivery, and calls Apprise API.

Apprise API owns provider-specific notification delivery. The first channel is Enterprise WeChat group bot through the `wecombot://` URL scheme.

Platform services publish notification intent. They do not call Enterprise WeChat directly and do not store provider credentials.

Inbound Enterprise WeChat messages are handled by `wecom-callback-adapter`, which keeps the public callback protocol outside the outbound notification dispatcher.

## external fields

NATS subject:

- `platform.notifications.requested`

Event payload:

- `platform.notification.v1.NotificationRequest`

Apprise secret:

- `notification-apprise-urls.urls`

For Enterprise WeChat group bot, the value is the webhook URL or `wecombot://<bot-key>`.

## implementation notes

Kubernetes resources are rendered by the `platform-notifications` chart (`deploy/charts/platform-notifications`).
Inbound callback traffic is published through a Gateway API `HTTPRoute` that attaches to the shared Istio `platform-ingress` Gateway.

Runtime flow:

1. Platform service publishes a `platform.notification.v1.NotificationRequest` protobuf message to `platform.notifications.requested`.
2. `notification-dispatcher` consumes the subject through the durable JetStream consumer `platform-notification-dispatcher`.
3. `notification-dispatcher` maps `title`, `body`, `type`, and `format` into an Apprise API request.
4. Apprise API sends the notification to the configured provider URLs.

The dispatcher ensures the `PLATFORM_NOTIFICATIONS` JetStream stream exists and uses explicit ack plus bounded redelivery for delivery failures.

Enterprise WeChat egress is allowlisted through the existing Envoy egress gateway by the `platform-egress-service` system policy registry. It is a transparent egress rule, so Envoy owns the outlet route without attaching auth header `ext_proc`.

Apprise API uses the container system trust store; transparent HTTPS egress is owned by Istio Ambient.

The dispatcher pod template sets restricted-compatible security context for the `code-code` namespace.

This path is for platform-initiated notifications. Prometheus alerts remain Alertmanager-owned.

Validation:

- `helm lint deploy/charts/platform-notifications`
- `helm template platform-notifications deploy/charts/platform-notifications -f deploy/charts/platform-notifications/examples/local.yaml`

References:

- https://appriseit.com/api/
- https://appriseit.com/services/wecombot/
