# Notification Dispatcher

## responsibility

`notification-dispatcher` wires platform notification events to external notification channels through a service-owned durable NATS JetStream consumer.

It uses:

- `notification-dispatcher` Go service for NATS consumption and Apprise delivery
- Apprise API for provider delivery
- existing Istio Ambient egress for external HTTPS
- NATS subject `platform.notifications.requested`
- WeCom callback endpoint `GET|POST /wecom/callback`
- WeCom robot callback endpoint `GET|POST /wecom/robots/default/callback`

## apply

Create the provider Secret out of band:

```bash
kubectl -n code-code create secret generic notification-apprise-urls \
  --from-literal=urls='<enterprise-wechat-webhook-url>'
```

The Enterprise WeChat webhook key must stay in the Secret only. Do not commit the webhook URL or bot key into this repo.

Create the inbound callback Secret out of band:

```bash
kubectl -n code-code create secret generic wecom-callback \
  --from-literal=token='<wecom-callback-token>' \
  --from-literal=encoding-aes-key='<43-char-encoding-aes-key>'
```

The callback URL is provided by this deployment and configured in Enterprise WeChat:

- `https://bot.pood1e.monster:8443/wecom/callback`
- `https://bot.pood1e.site/wecom/callback`

Create one robot callback Secret per robot:

```bash
kubectl -n code-code create secret generic wecom-robot-default-callback \
  --from-literal=token='<wecom-robot-token>' \
  --from-literal=encoding-aes-key='<43-char-wecom-robot-encoding-aes-key>'
```

Configure the first robot with:

- `https://bot.pood1e.monster:8443/wecom/robots/default/callback`

Deploy through the release chart after the Secrets exist:

```bash
DEPLOY_NOTIFICATION_DISPATCHER=1 \
NOTIFICATION_INGRESS_PRIMARY_HOST=bot.pood1e.site \
NOTIFICATION_INGRESS_SECONDARY_HOST=bot.pood1e.monster \
NOTIFICATION_INGRESS_TLS_SECRET_NAME=platform-notifications-prod-tls \
deploy/release.sh deploy
```

`notification-dispatcher` egress is declared as managed Gateway API YAML with `egress-source=system` metadata.

## test

Publish one `platform.notification.v1.NotificationRequest` protobuf message to the subject from a platform publisher or a local smoke helper.

The dispatcher owns a durable JetStream consumer named `platform-notification-dispatcher` and retries failed Apprise delivery with bounded redelivery.

The app callback adapter publishes verified inbound messages as `platform.notification.v1.InboundMessageEvent` to `platform.wecom.messages.received`.

The first robot callback adapter publishes verified inbound messages to `platform.wecom.robots.default.messages.received`.
