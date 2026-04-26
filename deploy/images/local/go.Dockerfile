# Local-only Go packaging — no BuildKit features needed.

FROM scratch

ARG GO_LOCAL_BINARY
ARG GO_LOCAL_CA_BUNDLE

ENV USER=nonroot

COPY ${GO_LOCAL_CA_BUNDLE} /etc/ssl/certs/ca-certificates.crt
COPY ${GO_LOCAL_BINARY} /service

USER 65532:65532

ENTRYPOINT ["/service"]
