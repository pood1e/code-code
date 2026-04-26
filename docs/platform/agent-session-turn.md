# AgentSession Turn

这份文档定义面向 `AgentSession` 的用户层 `Turn` 模型，以及它与平台内部 `AgentRun` 的关系。

## 职责

`Turn` 是一次用户输入。

`Turn` 负责表达：

- 一次用户发起的输入
- 这次输入对应的用户层生命周期
- 最终用户可见结果
- cancel / retry 语义

`Turn` 不负责表达：

- Pod / Workflow / PVC identity
- session-level config 真相
- execution runtime 的底层细节

观测模型见 [agent-session-observability.md](./agent-session-observability.md)。
调度模型见 [agent-session-action.md](./agent-session-action.md)。

## 最小字段

- `TurnID`
  作用：用户层稳定标识。
- `SessionRef`
  作用：标识所属 `AgentSession`。
- `Input`
  作用：保存这次用户输入。
- `Status`
  作用：表达用户层 turn 当前状态。
- `RunRef`
  作用：可选关联的内部 `AgentRun`。
- `Output`
  作用：保存本轮用户可见输出切片。
- `ResultSummary`
  作用：保存用户可见的最终结果摘要。
- `CreatedAt`
  作用：记录创建时间。
- `UpdatedAt`
  作用：记录最近更新时间。

## Input

当前只固定最小语义：

- `Kind`
  作用：输入类型。当前最小支持 `user_message`。
- `Text`
  作用：用户文本输入。

## ResultSummary

当前只固定最小语义：

- `Status`
  作用：本次 turn 的用户层最终状态。
- `Message`
  作用：用户可见摘要。
- `ErrorCode`
  作用：可选错误分类。
- `ResumeAvailable`
  作用：可选标识是否存在继续上下文能力。

## Output

`Turn.Output` 表示本轮输出切片。

它负责表达：

- 本轮最终 assistant messages
- 本轮最终 tool result summaries
- 本轮最终 usage summary

规则：

- `Output` 可以包含多条 messages。
- `Output` 只保存 result 型数据，不保存 delta 型数据。
- message delta、reasoning delta、tool streaming delta 只属于运行时 event stream，不进入持久化 `Turn` 模型。
- `Turn` 持久化的是本轮最终结果切片，而不是中间增量轨迹。

`TurnOutput` 的完整定义见 [agent-session-turn-output.md](./agent-session-turn-output.md)。

### Messages

`Output.Messages` 表示本轮最终消息集合。

规则：

- 一次 `Turn` 可以产生多条最终 messages。
- `Output.Messages` 直接复用 AG-UI `Message`，见 [../agent/message.md](../agent/message.md)。
- `Output.Messages` 是 result projection，不是 stream delta log。
- `Chat` 的消息历史由多个 `Turn.Output.Messages` 按顺序拼接得到。

### Tool Summaries

`Output.ToolSummaries` 表示本轮最终 tool 调用摘要集合。

规则：

- 只保存最终摘要，不保存 streaming 过程。

### Usage Summary

`Output.UsageSummary` 表示本轮最终 usage 汇总。

规则：

- 只保存 turn 级汇总，不保存底层逐请求 timeline。

## 与 AgentRun 的关系

`Turn` 和 `AgentRun` 不是同一个对象。

关系：

- 一个 `Turn` 在用户层最多暴露一个 `RunRef`
- 一个 `Turn` 先进入 `AgentSessionAction` 调度链，再可能产生 `AgentRun`
- 一个 `AgentRun` 必须属于一个 `AgentSession`
- `Turn` 创建后，可以先没有 `AgentRun`
- 当 execution 条件满足后，platform 才为这个 `Turn` 创建对应 `AgentRun`
- automatic retry / fallback 可以在同一个 `Turn` 背后创建新的内部 `AgentRun` attempt

规则：

- `Turn.RunRef` 指向当前或最后一次内部 `AgentRun`
- `retry` 永远创建新的 `Turn`
- controller-local automatic retry 不创建新的 `Turn`
- `RunRef` 是可选字段。
- `Turn` 创建时可以没有 `RunRef`。

## 状态机

`Turn` 最小状态集合：

- `Pending`
  作用：用户输入已提交，但尚未开始 execution。
- `Ready`
  作用：execution 前置条件已满足，准备创建 `AgentRun`。
- `Running`
  作用：已创建 `AgentRun`，execution 正在进行。
- `Succeeded`
  作用：本次输入已成功完成。
- `Failed`
  作用：本次输入已失败完成。
- `Canceled`
  作用：本次输入已被取消。

## 状态转移

### Pending -> Ready

表示：

- 对应 `AgentSession` 已达到可执行状态
- endpoint / skill / MCP / warm state 等前置条件已满足

说明：

- `Pending` 可以持续一段时间。
- 这段时间内，用户连接是否保持不断开，不影响状态推进。
- `platform-agent-runtime-service` 只负责写入 desired state，不持有会话内存状态。

### Ready -> Running

表示：

- controller 已为该 `Turn` 创建 `AgentRun`
- `AgentRun` 已提交到底层 execution runtime

在当前设计里，底层 execution runtime 的首选实现是 Temporal workflow + Kubernetes Job。

## Terminal 转移

### Running -> Succeeded

- 对应 `AgentRun` 成功完成

### Running -> Failed

- 对应 `AgentRun` 失败完成

### Pending/Ready/Running -> Canceled

- 用户取消 `Turn`
- 如果还没有 `AgentRun`，则直接结束 `Turn`
- 如果已经存在 `AgentRun`，则平台内部取消对应 `AgentRun`

## Trigger 规则

`Turn` 创建后，是否立即创建 `AgentRun`，由平台决定。

至少受以下因素影响：

- `AgentSession` 是否 ready
- session runtime config 是否 ready
- session resource config 是否 ready
- workspace / warm state 是否 ready
- 当前是否已有 active turn / active run

规则：

- 只有当 execution 前置条件满足时，`Turn` 才能进入 `Ready`
- 只有当 `Turn` 进入 `Ready` 时，platform 才能创建对应 `AgentRun`

## 平台无状态要求

这套模型要求：

- `platform-agent-runtime-service` 无状态
- 用户发起 `Turn` 后可以断开连接
- 后续由 controller 继续推进状态

实现语义：

- `Turn` desired state 必须持久化到平台真相
- `AgentSessionAction` pending state 必须持久化到平台真相
- `AgentSession` readiness 必须持久化到平台真相
- `AgentRun` execution summary 必须持久化到平台真相

因此：

- 用户连接断开不影响 turn 继续推进
- 重连后可以重新读取 `Turn` / `AgentRun` 的最新投影
- 重连后读取的是 result projection，而不是历史 delta stream
- 如果订阅 `SSE`，用户可以实时观察该 `Turn` 的 timeline projection 与派生耗时

## Temporal 的角色

Temporal 适合承接的是 `Turn` 的 execution half，而不是整个 `Turn` 生命周期。

边界：

- `Turn` 的 `Pending` / `Ready` 属于平台业务状态机
- `Turn` 进入 `Running` 后，execution 由 Temporal workflow 承接
- `AgentRun` 是 `Turn` 在 execution 期间的内部记录
- Temporal workflow phase 不直接等同于 `Turn` phase

## Delta 与 Result 的边界

- `AgentRun` 运行期间可以产生 delta 型 output event。
- delta 型 output 只用于 live stream / runtime observation。
- `Turn` 持久化时只保留 result 型 projection。
- `Turn` / `TurnOutput` 的 result projection 存在 Postgres。
- `AgentRunResource.status.resultSummary` 只保留 retry/fallback 需要的 terminal 摘要。
- `Turn.Output.Messages`、`ToolSummaries`、`UsageSummary` 都是最终结果，不是增量事件。
- 阶段 timeline 与耗时观测也不进入 `Turn.Output`；它们属于独立 observability path。

## 与 AgentRun 的边界

- `Turn` 可以持有 `RunRef`
- `AgentRun` 不反向持有 `TurnID`

规则：

- 用户层通过 `Turn.RunRef` 观察内部 execution 映射。
- `AgentRun` 直接归属于 `AgentSession`，不依赖用户层对象才能成立。

## 用户语义

- 用户看到的是 `Turn`
- 用户取消的是 `Turn`
- 平台内部运行的是 `AgentRun`
- 用户重试时，平台创建新的 `Turn`
