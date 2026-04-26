# Session Runtime Selector

## Responsibility

- 在 chat inline session setup 中提供稳定的 `provider / execution class / instance / model` 联动选择。

## External Surface

- `listSessionRuntimeOptions()`
- `useSessionRuntimeOptions()` in profile reference data
- inline runtime editor
  - provider select
  - execution class select
  - primary instance select
  - primary model select
  - fallback instance select
  - fallback model select

## Implementation Notes

- chat 页面只依赖 `/api/chats/session-runtime-options`。
- provider 切换时同步收敛 execution class、primary instance、primary model 到当前 provider 可用值。
- instance 切换时同步收敛 model 到该 instance 可用值。
- fallback row 使用同一份 options 规则，禁止展示无效 model 输入框状态。
