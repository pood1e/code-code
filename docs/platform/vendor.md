# Vendor

一等 vendor 元数据定义，表示一个 AI 服务提供商（如 OpenAI、Anthropic）。

## 职责

- 统一管理 vendor 标识、名称、图标、官网等基础元数据
- 作为 canonical `ModelDefinition`、template metadata 中 `vendor_id` 的权威来源
- 为 `VendorCapabilityPackage` 读路径提供 identity base

## Key Types

### `Vendor`

| 字段 | 用途 |
|------|------|
| `vendor_id` | 稳定标识符，对齐 canonical `ModelDefinition.vendor_id` |
| `display_name` | 人类可读名称 |
| `icon_url` | 厂商官方公开 logo URL |
| `website_url` | 官方网站 |
| `description` | 简短描述 |
| `aliases` | source catalog 使用的稳定别名，如 `mistralai` |

### `VendorRef`

| 字段 | 用途 |
|------|------|
| `vendor_id` | 引用一个 Vendor 的稳定标识符 |

## Registry

- owner: `vendors/identity`
- payload: `vendor_definition.v1.Vendor`
- delivery: service-registered catalog

## 边界

- `vendor_definition.v1.Vendor` 静态 registry 只持有 vendor identity 与展示信息
- vendor 的 API key specialization、registry source、observability 归 `VendorCapabilityPackage`
- 模型是 direct / indirect / aggregated 不由 `Vendor` 表达，而由 vendor package 的 model source 表达
- `aliases` 既用于 browser vendor lookup，也用于 model collector 将 source vendor 名称命中到 canonical vendor，例如 `github-models -> github`
- `icon_url` 是 vendor 官方公开 logo URL
- 不持有运行时状态，无 controller reconcile loop

## Management Service

- `vendors/identity` 暴露 `VendorManagementService.List()`，返回所有 vendor 定义
- `vendors/support` 暴露 `ManagementService.List()` / `Get()`，返回 vendor support packages
- `vendors/support` 的读路径供 provider connect、observability、model collection 读取同一份静态 package 视图
- 只读，不提供 Create/Update/Delete
