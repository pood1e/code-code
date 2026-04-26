# Agent Result Contract

这份文档定义 agent run 的 result contract。

## 模型图

```text
RunResult
  -> RunStatus
  -> RunError
```

## RunResult

表示 run 的最终结果。

字段：

- `Status`
  作用：run 最终状态。
- `ResumeToken`
  作用：后续继续上下文所需标识。
- `Error`
  作用：失败或终止原因。

规则：

- `Completed` 时不能带 `Error`。
- `Failed` 时必须带有效 `Error`，且不能带 `ResumeToken`。
- `Cancelled` 时如果带 `Error`，必须是有效 `Error`；不能带 `ResumeToken`。
- `Interrupted` 时必须带 `ResumeToken`；如果带 `Error`，必须是有效 `Error`。

## RunStatus

表示 run 最终状态。

枚举值：

- `Completed`
  作用：run 正常完成。
- `Failed`
  作用：run 失败。
- `Cancelled`
  作用：run 被取消。
- `Interrupted`
  作用：run 被中断但可继续。

## RunError

表示结构化失败信息。

字段：

- `Code`
  作用：稳定错误分类。
- `Message`
  作用：可读错误说明。
- `Retryable`
  作用：标识平台是否可以安全重试。
