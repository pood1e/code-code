# CLI Definition

一等 CLI 基础定义，表示一个平台已知的 CLI identity（如 Codex CLI、Qwen CLI）。

## 职责

- 声明式管理 CLI 的基础元数据
- 为 console 和 management API 提供 CLI 注册表
- 作为 `CLISpecializationPackage` 的 identity base

## Key Types

### `CLIDefinition`

| 字段 | 用途 |
|------|------|
| `cli_id` | 稳定标识符 |
| `display_name` | 人类可读名称 |
| `icon_url` | CLI 官方公开 logo URL |
| `website_url` | 官方网站 |
| `container_images[]` | 可运行的 image variants 与默认 resource requests |
| `description` | 简短描述 |

说明：

- `container_images[]` 是 runtime-facing contract，负责声明每个 execution class 对应的 image / CPU / memory requests
- CLI auth methods、OAuth contract、CLI-consumable model access 归 `CLISpecializationPackage`
- agent runtime 的 native sidecar bootstrap contract 后续单独定义；CLI 只作为其中一种内部实现，不属于 `CLIDefinition` 主线

## Registry

- owner: `clidefinitions/identity`
- payload: `cli_definition.v1.CLIDefinition`
- delivery: service-registered catalog

## 边界

- `CLIDefinition` 持有基础 identity、展示信息，以及可运行 image variants
- CLI specialization 归 `CLISpecializationPackage`
- `icon_url` 直接引用 CLI 官方公开 logo URL，平台不再自托管 CLI 图标
- 不持有运行时状态，无 controller reconcile loop

## Management Service

- `clidefinitions/identity` 暴露 `CLIDefinitionManagementService.List()`，返回所有 CLI 定义
- `clidefinitions/identity` 暴露 execution class -> image/resources 的 resolve 主线，供 session validation 与 run freeze 复用
- `clidefinitions/specializations` 负责 `CLISpecializationPackage` 读取
- `clidefinitions/oauth` 负责 CLI-owned OAuth contract / projection / sidecar config 解析
- `clidefinitions/observability` 负责 CLI-owned OAuth runtime metrics
- 只读，不提供 Create/Update/Delete
