# platform-notifications

![Version: 0.1.0](https://img.shields.io/badge/Version-0.1.0-informational?style=flat-square) ![Type: application](https://img.shields.io/badge/Type-application-informational?style=flat-square) ![AppVersion: 0.0.0](https://img.shields.io/badge/AppVersion-0.0.0-informational?style=flat-square)

Optional notification delivery addons for the code-code platform.

**Homepage:** <https://github.com/pood1e/code-code>

## Maintainers

| Name | Email | Url |
| ---- | ------ | --- |
| code-code platform team |  |  |

## Source Code

* <https://github.com/pood1e/code-code>

## Requirements

Kubernetes: `>=1.31.0-0 <1.37.0-0`

## Install

Install from the repository root:

```bash
helm upgrade --install code-code-platform-notifications deploy/charts/platform-notifications \
  --namespace <namespace> \
  --create-namespace \
  -f deploy/charts/platform-notifications/examples/<env>.yaml
```

## Example Values

Review environment-specific overrides under `examples/` before installing.

## Values

Documented user-facing overrides. Regenerate this file with:

```bash
make -C deploy docs
```

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| global.imageRegistry | string | `""` | Optional registry prefix prepended to platform-notifications images. |
| global.imageTag | string | `"0.0.0"` | Shared image tag used for platform-notifications images. |
| global.infraNamespace | string | `"code-code-infra"` | Namespace where NATS and other shared infrastructure live. |
| notificationDispatcher.enabled | bool | `true` | Enable or disable the notification subsystem. |
| notificationDispatcher.natsUrl | string | `"nats://nats.code-code-infra.svc.cluster.local:4222"` | NATS URL consumed by the dispatcher and inbound adapters. |
| notificationDispatcher.subject | string | `"platform.notifications.requested"` | NATS subject consumed by the dispatcher. |
| notificationDispatcher.secretNames.appriseUrls | string | `"notification-apprise-urls"` | Secret containing Apprise destination URLs. |
| notificationDispatcher.secretNames.wecomCallback | string | `"wecom-callback"` | Secret containing WeCom callback token and AES key. |
| notificationDispatcher.secretNames.wecomRobotDefaultCallback | string | `"wecom-robot-default-callback"` | Secret containing the default WeCom robot callback token and AES key. |
| notificationDispatcher.route.enabled | bool | `true` | Publish inbound notification endpoints through a Gateway API HTTPRoute. |
| notificationDispatcher.route.hosts | list | `["notifications-primary.placeholder.invalid","notifications-secondary.placeholder.invalid"]` | Host list served by the inbound notification HTTPRoute. |
| notificationDispatcher.route.parentRef.name | string | `"platform-ingress"` | Gateway name used by the notification HTTPRoute. |
| notificationDispatcher.route.parentRef.namespace | string | `"code-code-net"` | Gateway namespace used by the notification HTTPRoute. |
| notificationDispatcher.route.parentRef.sectionName | string | `"http"` | Gateway listener section used by the notification HTTPRoute. |
| notificationDispatcher.dispatcher.imageName | string | `"notification-dispatcher"` | Platform image name for the dispatcher Deployment. |
| notificationDispatcher.appriseApi.image.repository | string | `"caronc/apprise"` | Container repository for the bundled Apprise API. |
| notificationDispatcher.appriseApi.image.tag | string | `"1.3.3"` | Container tag for the bundled Apprise API. |
| notificationDispatcher.wecomCallbackAdapter.imageName | string | `"wecom-callback-adapter"` | Platform image name for the WeCom callback adapter. |
| notificationDispatcher.wecomRobotDefaultCallbackAdapter.imageName | string | `"wecom-callback-adapter"` | Platform image name for the default WeCom robot callback adapter. |
