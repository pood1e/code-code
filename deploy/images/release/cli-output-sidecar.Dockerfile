# syntax=docker/dockerfile:1

FROM golang:1.26-bookworm AS build

ARG HTTP_PROXY
ARG HTTPS_PROXY
ARG NO_PROXY
ARG GOPROXY

ENV CGO_ENABLED=0 \
    GOOS=linux \
    GOPROXY=${GOPROXY}

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

RUN cd /workspace && go work use ./deploy/agents/sidecars/cli-output

RUN --mount=type=cache,target=/go/pkg/mod,id=code-code-cli-output-go-mod-cache,sharing=locked \
    --mount=type=cache,target=/root/.cache/go-build,id=code-code-cli-output-go-build-cache,sharing=locked \
    HTTP_PROXY="${HTTP_PROXY}" HTTPS_PROXY="${HTTPS_PROXY}" NO_PROXY="${NO_PROXY}" \
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
