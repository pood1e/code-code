# Gemini OAuth Project

## Responsibility

- `gemini-cli` OAuth import 阶段补充解析 `loadCodeAssist`
- 将 `cloudaicompanionProject.id` 与 tier 名称落到 credential material `project_id` / `tier_name`
- 仅作为 Gemini CLI specialized material 保存

## External Fields

- credential material `project_id`
- credential material `tier_name`

## Implementation

- `credentials.OAuthCredentialImporter` 仅在 `cli_id = gemini-cli` 时执行 enrichment
- 若本次未解析到 project/tier，则保留已有 `project_id` / `tier_name`
- active probe 也会用 `loadCodeAssist` 回写 `project_id` / `tier_name`
- `account_summary_fields` 可通过 credential material source 读取 `project_id` / `tier_name`
- observability 通过 `retrieveUserQuota` 聚合 `Pro / Flash / Flash Lite`
- provider card 展示 tier badge、百分比进度条与本地时间 `resetAt`
