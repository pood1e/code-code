# Agent Profile Web Package

## Responsibility

- `console-web-agentprofile` 拥有 shell 内的 `Profiles` section。
- shell 侧栏只暴露 `Profiles` 一个一级入口。
- package 定义 section metadata、lazy routes 和基于 management API 的 agent config pages。
- profile create / edit 主链保持在列表页 dialog 内完成。

## External Surface

- `AGENT_PROFILE_SECTIONS`
- `AGENT_PROFILE_ROUTES`

## Implementation Notes

- routes 只保留 `profiles`。
- 页面固定走 `console-web -> console-api -> platform-profile-service`。
- `Profiles` 页面本身用 tab 承接 `Profiles`、`MCPs`、`Skills`、`Rules` 四类资源。
- `Profiles` tab 负责 profile scan、entry action、`Delete profile` 和编辑 dialog 入口。
- 页面 tabs 不展示资源计数。
- profile 卡片保持紧凑扫描：`name`、来自 CLI specialization package `icon_url` 的 CLI 图标与名称、execution class、ordered fallback chain、已选资源标签，以及卡片内 `Edit` / `Delete`。
- 高频小动作使用 icon-first action，不使用纯文本操作按钮。
- 页面容器优先复用 Radix Themes `Card`，小动作统一复用 Radix Themes `IconButton` 语义。
- `fallback chain` 行必须体现顺序、vendor icon、provider、endpoint、modelId、可用状态。
- fallback 可选项必须受当前 CLI 支持的 provider type 限制。
- mock-first 阶段也必须经由 package-local CLI specialization reference data 解析 `display_name`、`icon_url` 与 supported provider types，不允许页面本地硬编码 CLI 图标。
- profile editor dialog 只保留编辑态表单，不再拆二级 tabs。
- dialog 用分区承接基础字段、fallback chain、`MCPs`、`Skills`、`Rules` 选择。
- profile dialog 只处理引用选择与移除，不承接资源本体 CRUD。
- 资源本体 CRUD 放在主页面的 `MCPs`、`Skills`、`Rules` tabs 内。
- profile 卡片主链用 `GET /api/agent-profiles` + `GET /api/agent-profiles/:id` 组合展示完整只读信息。
- `MCPs`、`Skills`、`Rules` tab 列表只消费各自 list surface；编辑已有资源时再按需调用 `GET /api/mcps/:id`、`GET /api/skills/:id`、`GET /api/rules/:id` 读取完整表单数据。
- fallback 选择器只允许选择当前 CLI specialization 支持的 provider type，并使用真实 provider endpoint / endpoint / model 数据组装 `provider -> endpoint -> model` 流程。
- 资源选择区无选中项时不渲染空状态块，只保留操作条。
- profile 卡片与 dialog 内的资源关联只用极简标签展示名称，不重复展示计数或冗余标题。
- dialog 内 `MCPs`、`Skills`、`Rules` 选择收敛为单个紧凑 `Resources` 区，按行展示 label、已选标签与 `Add`。
- 页面不展示预览型文案、原型标签或与当前决策无关的说明块。
- `MCP` dialog 按官方 MCP transport 结构收敛为 `stdio` / `Streamable HTTP`。
- `Skill`、`Rule` dialog 使用 `name`、`description`、`content`。
- `Skill`、`Rule` 列表只展示 `name` 与 `description`，不直接展示长文本 `content`。
- 删除 `MCP`、`Skill`、`Rule` 时，所有 profile 关联一并清理。
- shell app 只消费 section 与 route，不持有 profile 页面细节。
