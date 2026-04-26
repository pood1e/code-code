FROM --platform=$BUILDPLATFORM golang:1.26-bookworm AS build

ARG HTTP_PROXY
ARG HTTPS_PROXY
ARG NO_PROXY
ARG GOPROXY
ARG TARGETARCH=amd64
ARG SERVICE_MODULE
ARG SERVICE_NAME

ENV CGO_ENABLED=0 \
    GOOS=linux \
    GOARCH=${TARGETARCH} \
    GOFLAGS=-mod=readonly \
    GOPROXY=${GOPROXY}

WORKDIR /workspace/${SERVICE_MODULE}

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

RUN HTTP_PROXY="${HTTP_PROXY}" HTTPS_PROXY="${HTTPS_PROXY}" NO_PROXY="${NO_PROXY}" \
    go mod download

COPY packages/agent-runtime-contract /workspace/packages/agent-runtime-contract
COPY packages/console-api /workspace/packages/console-api
COPY packages/go-contract /workspace/packages/go-contract
COPY packages/platform-contract /workspace/packages/platform-contract
COPY packages/platform-k8s /workspace/packages/platform-k8s
COPY packages/session /workspace/packages/session

RUN HTTP_PROXY="${HTTP_PROXY}" HTTPS_PROXY="${HTTPS_PROXY}" NO_PROXY="${NO_PROXY}" \
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
