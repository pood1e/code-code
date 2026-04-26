# syntax=docker/dockerfile:1

FROM --platform=$BUILDPLATFORM rust:1.88-bookworm AS build

ARG HTTP_PROXY
ARG HTTPS_PROXY
ARG NO_PROXY
ARG WASM_PACKAGE_DIR=packages/platform-k8s/egress-auth-wasm
ARG WASM_ARTIFACT_NAME=egress_auth_wasm
ARG WASM_TARGET_CACHE_ID=code-code-egress-auth-wasm-target

ENV PATH=/usr/local/cargo/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin \
    CARGO_REGISTRIES_CRATES_IO_PROTOCOL=sparse

WORKDIR /workspace/${WASM_PACKAGE_DIR}

COPY ${WASM_PACKAGE_DIR}/Cargo.toml ./
COPY ${WASM_PACKAGE_DIR}/Cargo.lock ./
COPY ${WASM_PACKAGE_DIR}/src ./src

RUN --mount=type=cache,target=/usr/local/cargo/registry,id=code-code-cargo-registry,sharing=locked \
    --mount=type=cache,target=/usr/local/cargo/git,id=code-code-cargo-git,sharing=locked \
    HTTP_PROXY="${HTTP_PROXY}" HTTPS_PROXY="${HTTPS_PROXY}" NO_PROXY="${NO_PROXY}" \
    rustup target add wasm32-unknown-unknown && \
    cargo fetch --locked
RUN --mount=type=cache,target=/usr/local/cargo/registry,id=code-code-cargo-registry,sharing=locked \
    --mount=type=cache,target=/usr/local/cargo/git,id=code-code-cargo-git,sharing=locked \
    --mount=type=cache,target=/workspace/${WASM_PACKAGE_DIR}/target,id=${WASM_TARGET_CACHE_ID},sharing=locked \
    HTTP_PROXY="${HTTP_PROXY}" HTTPS_PROXY="${HTTPS_PROXY}" NO_PROXY="${NO_PROXY}" \
    cargo build --locked --release --target wasm32-unknown-unknown && \
    mkdir -p /out && \
    cp "target/wasm32-unknown-unknown/release/${WASM_ARTIFACT_NAME}.wasm" /out/plugin.wasm

FROM scratch

COPY --from=build /out/plugin.wasm ./plugin.wasm
