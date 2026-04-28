# syntax=docker/dockerfile:1

FROM --platform=$BUILDPLATFORM golang:1.26-bookworm AS build

ARG GOPROXY
ARG TARGETOS=linux
ARG TARGETARCH=amd64

ENV CGO_ENABLED=0 \
    GOOS=${TARGETOS} \
    GOARCH=${TARGETARCH} \
    GOPROXY=${GOPROXY}

RUN test -n "${TARGETOS}" && test -n "${TARGETARCH}"

WORKDIR /workspace/deploy/agents/sidecars/cli-output

COPY go.work /workspace/go.work
COPY go.work.sum /workspace/go.work.sum
COPY deploy/agents/sidecars/cli-output/go.mod /workspace/deploy/agents/sidecars/cli-output/go.mod
COPY packages/agent-runtime-contract/go.mod /workspace/packages/agent-runtime-contract/go.mod
COPY packages/agent-runtime-contract/go.sum /workspace/packages/agent-runtime-contract/go.sum
COPY packages/console-api/go.mod /workspace/packages/console-api/go.mod
COPY packages/console-api/go.sum /workspace/packages/console-api/go.sum
COPY packages/go-contract/go.mod /workspace/packages/go-contract/go.mod
COPY packages/go-contract/go.sum /workspace/packages/go-contract/go.sum
COPY packages/platform-contract/go.mod /workspace/packages/platform-contract/go.mod
COPY packages/platform-contract/go.sum /workspace/packages/platform-contract/go.sum
COPY packages/platform-k8s/go.mod /workspace/packages/platform-k8s/go.mod
COPY packages/platform-k8s/go.sum /workspace/packages/platform-k8s/go.sum
COPY packages/session/go.mod /workspace/packages/session/go.mod
COPY packages/session/go.sum /workspace/packages/session/go.sum
COPY packages/showcase-api/go.mod /workspace/packages/showcase-api/go.mod
COPY packages/showcase-api/go.sum /workspace/packages/showcase-api/go.sum

RUN cd /workspace && go work use ./deploy/agents/sidecars/cli-output

RUN --mount=type=cache,target=/go/pkg/mod,id=code-code-cli-output-go-mod-cache,sharing=locked \
    --mount=type=cache,target=/root/.cache/go-build,id=code-code-cli-output-go-build-cache,sharing=locked \
    go mod download

COPY deploy/agents/sidecars/cli-output /workspace/deploy/agents/sidecars/cli-output
COPY packages/go-contract /workspace/packages/go-contract
COPY packages/session /workspace/packages/session

RUN --mount=type=cache,target=/go/pkg/mod,id=code-code-cli-output-go-mod-cache,sharing=locked \
    --mount=type=cache,target=/root/.cache/go-build,id=code-code-cli-output-go-build-cache,sharing=locked \
    go build -trimpath -ldflags="-s -w" -o /out/cli-output-sidecar ./cmd/cli-output-sidecar

FROM scratch

USER 65532:65532

COPY --from=build /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
COPY --from=build /out/cli-output-sidecar /cli-output-sidecar

ENTRYPOINT ["/cli-output-sidecar"]
