# platform-notifications

`platform-notifications` owns the optional inbound notification subsystem.

It currently renders:

- `notification-dispatcher`
- `apprise-api`
- `wecom-callback-adapter`
- `wecom-robot-default-callback-adapter`
- optional ingress

Install:

```bash
helm upgrade --install code-code-platform-notifications deploy/k8s/charts/platform-notifications \
  --namespace code-code \
  --create-namespace \
  -f deploy/k8s/charts/platform-notifications/examples/local.yaml
```

Required Secrets:

- `${notificationDispatcher.secretNames.appriseUrls}` with key `urls`
- `${notificationDispatcher.secretNames.wecomCallback}` with keys `encoding-aes-key`, `token`
- `${notificationDispatcher.secretNames.wecomRobotDefaultCallback}` with keys `encoding-aes-key`, `token`

If `notificationDispatcher.ingress.enabled=true`, the referenced TLS Secret must also exist.
