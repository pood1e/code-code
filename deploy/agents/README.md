# Agent Images

这目录集中管理 agent runtime image 的打包资产。

## Layout

- `common/`
  - 多个 agent image 共享的 shell 脚本
- `<agent>/`
  - 单个 agent runtime 的 entrypoint
  - 单个 agent runtime 的 prepare job 入口

当前目录层次：

- `common/`
  - `auth-helper.sh`
  - `cli-output-runtime.sh`
- `sidecars/`
  - `cli-output/`
    - `Dockerfile`
    - `README.md`
- `claude-code/`
  - `entrypoint.sh`
  - `prepare.sh`
- `gemini-cli/`
  - `entrypoint.sh`
  - `prepare.sh`
- `qwen-cli/`
  - `entrypoint.sh`
  - `prepare.sh`

## Agent Notes

- `claude-code`
  - 主容器通过本地 settings 和 `apiKeyHelper` 发出 placeholder `x-api-key`
  - 真 API key 只允许由 Envoy auth processor 在请求时替换
- `qwen-cli`
  - 主容器只写官方 `~/.qwen/settings.json`
  - OpenAI-compatible API key path 会改写 `settings.json` 为 `openai` provider，并只写入 placeholder env
  - 真 API key 只允许由 Envoy auth processor 在请求时替换 `Authorization`
- `gemini-cli`
  - 主容器写入官方 `~/.gemini/settings.json` 与 `~/.gemini/oauth_creds.json`
  - `settings.json` 固定选择 `security.auth.selectedType = "oauth-personal"`
  - `oauth_creds.json` 固定写 placeholder `access_token` / `refresh_token` 与长过期时间，避免主容器走 refresh 主链
  - 官方 Gemini CLI 仍兼容从 `~/.gemini/oauth_creds.json` bootstrap OAuth cache，后续可迁移到自己的安全存储
  - entrypoint 会固定导出 `GOOGLE_GENAI_USE_GCA=true`，强制 Gemini CLI 走 Google OAuth mainline
  - Gemini image 只保留最小 runtime env；稳定 auth 配置直接写死，runtime 输入优先走文件
  - Gemini OAuth startup 会先调用 `oauth2.googleapis.com` 与 `www.googleapis.com` 做 token/user preflight，实际生成流量走 `cloudcode-pa.googleapis.com`
  - 真 OAuth token 只允许由 Envoy auth processor 在请求时替换 `Authorization`

## Rules

- Go 的 `clidefinitions` package 只保留 CLI specialization / runtime contract 代码，不夹带 image 打包脚本。
- 共享脚本优先放在 `common/`，CLI-specific 逻辑只放在对应 agent 目录。
- `cli-output-sidecar` image 资产与主容器 image 资产同属 `deploy/agents/` 域；不放在 `platform-k8s` package。
- `deploy/images/release/node-cli-agent.Dockerfile` 是共享 agent runtime Dockerfile；`deploy/images/docker-bake.hcl` 只负责 target 参数和镜像 tag。
- 所有 agent entrypoint 都应接受统一最小输入：
  - `AGENT_RUN_PROMPT`
  - `AGENT_RUN_MODEL`
- 所有 agent prepare 入口都应接受统一最小输入：
  - `AGENT_PREPARE_JOB_TYPE`
  - `AGENT_RUN_AUTH_MATERIALIZATION_KEY`
