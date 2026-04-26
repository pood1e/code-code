# Release Script

## responsibility

`deploy/release.sh` builds container images, validates release charts, and deploys the control-plane release.

## service targets

Core targets include `platform-auth-service`, `platform-model-service`, `platform-provider-service`, `platform-network-service`, `platform-profile-service`, `platform-agent-runtime-service`, `notification-dispatcher`, `platform-chat-service`, `console-api`, and `console-web`.

Infrastructure resources are rendered from `deploy/k8s/charts/infrastructure`, platform workloads are rendered from `deploy/k8s/charts/platform`, and platform-owned Istio custom resources are rendered from `deploy/k8s/charts/istio-platform`.
