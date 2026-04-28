# Docs

本目录保存当前 mainline 设计文档。

## 目录结构

| 目录 | 对应 packages | 说明 |
|---|---|---|
| `agent/` | `packages/agent-contract`, `packages/agent-runtime-contract` | agent domain model + runtime contract |
| `credential/` | `packages/go-contract/credential/`, `packages/agent-runtime-contract/credential/`, `packages/platform-contract/credential/` | credential data model + resolver + OAuth management |
| `provider/` | `packages/go-contract/provider/`, `packages/agent-runtime-contract/provider/` | LLM provider data model + runtime |
| `model/` | `packages/go-contract/model/`, `packages/platform-k8s/internal/modelservice/models/` | model definition + catalog |
| `platform/` | `packages/platform-contract/`, `packages/platform-k8s/` | control plane abstraction + K8s implementation |
| `console-api/` | `packages/console-api/` | BFF boundary + error mapping |
| `console-web/` | `packages/console-web/` | frontend shell design |
| `proto/` | `packages/proto/` | protobuf structure + codegen |

## 文档规范

- 每个非 trivial 变更必须先有对应的设计文档（AGENTS.md Rule 2）。
- 文档使用中文编写，专业术语使用英文。
- 设计文档放在 `docs/<domain>/<concept>.md`。
- 文档只保留三类信息：`responsibility`、关键外部字段或方法、最小实现说明。
- 发现过时的 scope、目标、Non-Goals、兼容说明或旧主链叙事时，直接删除或重写，不保留作历史材料。
- 文档内容只描述当前抽象与 mainline 设计，不包含实现代码。
