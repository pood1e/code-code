## responsibility

承接 `antigravity` 的 Google OAuth import 与 credential enrichment。

## key fields

- `credential secret.project_id`
- `credential secret.tier_name`

## notes

- import 必须在 credential 写入前解析出 `project_id`
- import 先调用 Cloud Code `loadCodeAssist`
- 若响应未直接返回 project，则继续调用 `onboardUser`
- `loadCodeAssist` / `onboardUser` 未返回 project 时，OAuth session 不进入成功态
- provider summary 从 credential secret 读取 `project_id` 与 `tier_name`
- Cloud Code `loadCodeAssist` / `fetchAvailableModels` 使用 native OAuth `User-Agent`
