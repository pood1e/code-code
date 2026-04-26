# Proto Package

本文定义 `packages/proto/` 的结构与 codegen 策略。

## Responsibility

`packages/proto/` 存放所有 `.proto` 源文件。Protobuf codegen 产物存放在 `packages/go-contract/`。

它负责：

- 定义跨服务共享的 data model（message types）
- 定义内部 gRPC service contract
- 通过 `buf generate` 产出 Go / Connect / TypeScript 代码

## Directory Layout

```text
proto/
  agent/                  # agent domain
    runtime_sidecar/      # agent: pod-local CLI output sidecar gRPC
  credential/             # credential domain
  cli_specialization_package/ # cli specialization domain
  provider/           # provider domain
  model/                  # model domain
  model_catalog_discovery/ # shared model catalog discovery operation contract
  platform/
    agent_session_action/    # platform: agent session action
    agent_session/           # platform: agent session
    agent_provider_binding/  # platform: agent provider binding
    agent_profile/           # platform: agent profile
    mcp/                     # platform: mcp server
    skill/                   # platform: skill
    rule/                    # platform: rule
    agent_run/               # platform: agent run
    run_event/               # platform: run delta/result/status event envelope
    management/              # platform: management gRPC service
  buf.yaml                # buf module config
  buf.gen.yaml            # buf generate config
  tools/                  # codegen helper scripts
```

## Naming Conventions

- Proto `package` 使用 `<domain>.<subdomain>.v1` 形式，例如 `platform.management.v1`。
- Proto 目录名使用 `snake_case`，与 Go package identifier 对齐。
- `go_package` 路径统一指向 `code-code.internal/go-contract/<domain>/<subdomain>/v1`。
- Message 名使用 `PascalCase`。
- Field 名使用 `snake_case`。

## Codegen Strategy

1. 在 `packages/proto/` 目录运行 `buf generate`。
2. Go protobuf、gRPC、Connect 代码产出到 `packages/go-contract/` 对应子目录。
3. TypeScript 代码产出到 `packages/agent-contract/src/gen/` 对应子目录。
4. codegen 后确保 `buf lint` 通过。

## Cross-Service Reference Rules

- 同一 `buf.yaml` module 内的 proto 可以 `import` 引用。
- `management.proto` 可引用 domain message types（如 `model.v1.ModelCapability`）。
- `management.proto` 应保持 console-facing management contract；agent-owned decision contract 不应塞回 management surface。

## Verification

```bash
cd packages/proto
buf lint
buf generate
```
