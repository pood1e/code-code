# Agent Profile Page

## Responsibility

- `Profiles` 页面承接 `AgentProfile` 的 create、update、delete 主链。
- 页面使用顶层 tabs 承接 `Profiles`、`MCPs`、`Skills`、`Rules` 四类资源。
- profile create / edit 使用列表页 dialog，不使用独立详情页。
- `MCPs`、`Skills`、`Rules` tab 承接资源本体 CRUD；profile 只维护引用关系。

## External Surface

- section key：`profiles`
- routes：`/profiles`
- query：
  - `tab=profiles|mcps|skills|rules`
- HTTP surface：
  - `GET /api/agent-profiles`
  - `GET /api/agent-profiles/:profileId`
  - `POST /api/agent-profiles`
  - `PUT /api/agent-profiles/:profileId`
  - `DELETE /api/agent-profiles/:profileId`
  - `GET /api/mcps`
  - `GET /api/mcps/:mcpId`
  - `POST /api/mcps`
  - `PUT /api/mcps/:mcpId`
  - `DELETE /api/mcps/:mcpId`
  - `GET /api/skills`
  - `GET /api/skills/:skillId`
  - `POST /api/skills`
  - `PUT /api/skills/:skillId`
  - `DELETE /api/skills/:skillId`
  - `GET /api/rules`
  - `GET /api/rules/:ruleId`
  - `POST /api/rules`
  - `PUT /api/rules/:ruleId`
  - `DELETE /api/rules/:ruleId`
  - `GET /api/providers/endpoints`
  - `GET /api/cli-specialization-packages`
  - `platform.provider.v1.ProviderService/ListVendors`

`AgentProfileListItem` 关键字段：

- `profile_id`
- `name`
- `provider_id`
- `selection_summary`
- `mcp_count`
- `skill_count`
- `rule_count`

`AgentProfileView` 关键字段：

- `profile_id`
- `name`
- `selection_strategy`
- `mcp_ids[]`
- `skill_ids[]`
- `rule_ids[]`

## Implementation Notes

- 页面数据路径固定是 `console-web -> console-api -> platform-profile-service`；`console-api` 不直连 Kubernetes，也不承接 `AgentProfile` 业务逻辑。
- `Profiles` 是独立 top-level section；`MCP`、`Skill`、`Rule` 不额外进入 shell 侧栏。
- `Profiles` tab 用卡片网格扫描 profile，卡片直接展示完整只读信息；编辑时进入 dialog。
- `MCPs`、`Skills`、`Rules` tab 用卡片网格管理资源本体；`Skill`、`Rule` 卡片只显示 `name + description`，不直接展示长文本。
- profile dialog 只负责：
  - `name`
  - `CLI`
  - `execution class`
  - ordered fallback chain
  - `MCPs`、`Skills`、`Rules` 引用选择
- 编辑既有 profile 时，`CLI` 和 `execution class` 只读；只有新建 profile 时允许变更。
- fallback editor 使用显式 `Move up` / `Move down` / `Remove`，添加流程固定是 `provider -> endpoint -> model`。
- fallback 展示固定包含 `provider icon + provider + endpoint + modelId + availability`。
- `MCP`、`Skill`、`Rule` 从 profile 中被移除时只解绑；资源本体删除由各自 tab 承接。
