# Deployment Images

## responsibility

This directory contains image build definitions for application and runtime images.

## Dockerfile groups

- `local/`: thin Dockerfiles that copy host-built artifacts into runtime images.
- `release/`: full Dockerfiles that build inside Docker for CI, release, and Docker-only runtime images.

## Go service images

- `platform-auth-service`: `packages/platform-k8s/cmd/platform-auth-service`
- `platform-model-service`: `packages/platform-k8s/cmd/platform-model-service`
- `platform-provider-service`: `packages/platform-k8s/cmd/platform-provider-service`
- `platform-network-service`: `packages/platform-k8s/cmd/platform-network-service`
- `platform-profile-service`: `packages/platform-k8s/cmd/platform-profile-service`
- `platform-cli-runtime-service`: `packages/platform-k8s/cmd/platform-cli-runtime-service`
- `platform-agent-runtime-service`: `packages/platform-k8s/cmd/platform-agent-runtime-service`
- `wecom-callback-adapter`: `packages/platform-k8s/cmd/wecom-callback-adapter`
- `platform-chat-service`: `packages/console-api/cmd/platform-chat-service`
- `console-api`: `packages/console-api/cmd/console-api`

## build notes

`deploy/release.sh build` defaults to the `app` group and uses local Go/Vite builds in non-CI shells.

`deploy/release.sh build runtime` builds Docker-only runtime images such as egress and agent CLI images.

`deploy/images/release/go-service.Dockerfile` is the shared release Dockerfile for Go services.
