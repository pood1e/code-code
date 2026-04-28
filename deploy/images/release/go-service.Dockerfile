# syntax=docker/dockerfile:1

FROM --platform=$BUILDPLATFORM golang:1.26-bookworm AS build

ARG GOPROXY
ARG TARGETOS=linux
ARG TARGETARCH=amd64
ARG SERVICE_MODULE
ARG SERVICE_NAME

ENV CGO_ENABLED=0 \
    GOOS=${TARGETOS} \
    GOARCH=${TARGETARCH} \
    GOFLAGS=-mod=readonly \
    GOPROXY=${GOPROXY}

WORKDIR /workspace/${SERVICE_MODULE}

RUN test -n "${SERVICE_MODULE}" && test -n "${SERVICE_NAME}"

COPY go.work /workspace/go.work
COPY go.work.sum /workspace/go.work.sum
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

RUN --mount=type=cache,target=/go/pkg/mod,id=code-code-go-mod-cache,sharing=locked \
    go mod download

COPY packages/agent-runtime-contract /workspace/packages/agent-runtime-contract
COPY packages/console-api /workspace/packages/console-api
COPY packages/go-contract /workspace/packages/go-contract
COPY packages/platform-contract /workspace/packages/platform-contract
COPY packages/platform-k8s /workspace/packages/platform-k8s
COPY packages/session /workspace/packages/session
COPY packages/showcase-api /workspace/packages/showcase-api

RUN --mount=type=cache,target=/go/pkg/mod,id=code-code-go-mod-cache,sharing=locked \
    --mount=type=cache,target=/root/.cache/go-build,id=code-code-go-build-cache,sharing=locked \
    go build -buildvcs=false -trimpath -ldflags="-s -w" -o /out/${SERVICE_NAME} ./cmd/${SERVICE_NAME}

FROM scratch

ARG EXPOSE_PORT=8081
ARG SERVICE_NAME

ENV USER=nonroot

USER 65532:65532

COPY --from=build /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
COPY --from=build /out/${SERVICE_NAME} /app

EXPOSE ${EXPOSE_PORT}

ENTRYPOINT ["/app"]
