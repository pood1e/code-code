# Deployment images

## Responsibility

Owns container image build definitions for platform services, agent runtimes, and sidecars.

## Layout

- `docker-bake.hcl` — single source of truth for all image targets and build groups (multi-arch, cache-aware).
- `release/` — release Dockerfiles consumed by `docker-bake.hcl`. Shared Dockerfiles are parameterized by Bake args instead of duplicated per target.

## Build groups

`docker-bake.hcl` defines four groups (see `docs/deploy/README.md` for usage):

- `default` — every image installed by `charts/platform` plus agent runtimes and sidecars.
- `platform` — platform backend and frontend service images.
- `runtime` — only agent runtime images (`claude-code-agent`, `agent-cli-qwen`, `agent-cli-gemini`, `cli-output-sidecar`).
- `optional` — `notification-dispatcher`, `wecom-callback-adapter`. Not built by default.

## Agent CLI versions

Release agent images do not install floating npm `latest` versions. The current validated defaults are:

- `CLAUDE_CODE_CLI_VERSION=2.1.121`
- `QWEN_CLI_VERSION=0.15.4`
- `GEMINI_CLI_VERSION=0.39.1`

Override these through `deploy/Makefile` or the buildx bake environment when intentionally testing a newer CLI.

## Go service images

- `platform-auth-service`, `platform-model-service`, `platform-provider-service`, `platform-egress-service`, `platform-profile-service`, `platform-support-service`, `platform-cli-runtime-service`, `platform-agent-runtime-service` — `packages/platform-k8s/cmd/<name>` via `release/go-service.Dockerfile`.
- `platform-chat-service`, `console-api` — `packages/console-api/cmd/<name>` via the same shared Dockerfile (different `SERVICE_MODULE`).
- `showcase-api` — `packages/showcase-api/cmd/showcase-api` via the same shared Dockerfile.
- `notification-dispatcher`, `wecom-callback-adapter` — same shared Dockerfile, opt-in via the `optional` group.

## Console / sidecar

- `console-web`, `showcase-web` — `release/web-static.Dockerfile`, multi-stage pnpm + nginx-unprivileged.
- `cli-output-sidecar` — `release/cli-output-sidecar.Dockerfile`, scratch base, source under `deploy/agents/sidecars/cli-output/`.

## Build commands

All build paths go through `deploy/Makefile`:

```bash
make -C deploy build BAKE_TARGET=default        # everything used by `make deploy`
make -C deploy build BAKE_TARGET=runtime        # only agent runtimes
make -C deploy push  BAKE_TARGET=platform IMAGE_REGISTRY=192.168.0.126:30500/
make -C deploy bake-print                       # dump resolved bake config
make -C deploy bake-check                       # Docker Buildx static checks
make -C deploy bake-check-remote                # run Buildx checks on REMOTE_DOCKER_HOST
```

`bake-check-remote` sends only the Dockerfile/Bake check context, not the full repository. Override `REMOTE_DOCKER_HOST` and `REMOTE_BAKE_PLATFORM` when using a different builder host or platform.

For end-to-end deploy flow see `docs/deploy/README.md`.
