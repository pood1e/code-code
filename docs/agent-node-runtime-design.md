# 智能节点运行能力设计方案

> 状态：草案  
> 目标：从当前原始 `AgentRunner -> Session -> Pipeline/Governance bridge` 形态，抽取统一的智能节点运行能力，支撑深度定制、健壮性、可观测性，以及后续用多个 Pipeline 组合替代 Governance 编排。

---

## 1. 文档目的

本文档回答四件事：

1. 现在项目已经具备哪些与 Agent 运行相关的能力
2. 这些能力分别落在什么架构层，为什么还不足以支撑“智能节点”
3. 智能节点应该抽象成什么模型、仓储、运行时和生命周期
4. Pipeline 如何在“不做跨节点记忆共享”的前提下支持并发，并让 Governance 后续可被拆成多个 Pipeline

本文档尽量脱离仓库上下文即可理解；文末再给出当前代码实现映射，方便落地。

---

## 2. 先定义几个概念

### 2.1 物理 Runner

物理 Runner 是具体执行 Agent 的底层运行器，例如 Claude Code、Cursor CLI、Qwen CLI。  
它解决的是“如何调用某个 Agent 平台并拿到流式输出”的问题。

### 2.2 物理 Session

物理 Session 是某个 Runner 上的一次会话实例。  
它通常绑定单一 Runner、单一运行态、单一会话状态。

### 2.3 智能节点

智能节点是 Pipeline 中可复用的“Agent 执行单元”。  
它不等于 Runner，也不等于物理 Session。它至少要包含：

- 节点级规则、MCP、Skill、Prompt、输出协议
- 多 Runner 候选与选择策略
- 节点内完整记忆
- 可由外部流程控制的新建 / 复用会话
- 完整生命周期、错误恢复和可观测性

### 2.4 节点会话

为避免和当前 `AgentSession` 概念冲突，本文把“节点级逻辑会话”叫做 **Node Conversation**。  
它是智能节点视角的会话容器，允许：

- 一个逻辑会话下挂多个物理 Session
- 会话切换 Runner 后仍保留统一记忆与统一历史
- 外部 Pipeline 显式决定“新建”还是“复用”

### 2.5 范围边界

本方案明确：

- 需要 Pipeline 并发
- 不需要跨节点共享记忆
- 节点之间只通过 Pipeline 输入输出和领域数据交互
- 智能节点必须有独立模型和独立仓储

### 2.6 TaskForest

为了让 Governance、特性开发、测试等不同事务都能成立，`Pipeline` 不能再理解为“线性 stage 列表”，而要升级成 **编排 Task 的事务流**。

从运行形态看，项目空间内不会只有一张大图，而是：

- 一个 `Project` 下存在多条 `Pipeline`
- 每条 `Pipeline` 负责一种事务，例如特性开发、治理发现、测试编排
- 每条 `Pipeline` 在运行时会展开出一片动态的 **TaskForest**

这里用 `TaskForest`，而不是死绑 `TaskDAG`，原因是：

- 在业务语义上，任务更接近“多棵动态树”
- 一条 Pipeline 往往会从一个根任务分裂出多条子树
- 某些聚合、屏障、人工介入节点仍可视为树上的控制节点

如果从实现角度需要图论抽象，底层仍可用 DAG 能力实现调度；但对业务建模而言，建议统一使用 **TaskForest** 这个术语。

这里建议的关系是：

- `Project`：项目空间，承载代码仓库、文档仓库、会话、多个 Pipeline
- `Pipeline`：项目内某一类事务的编排入口与运行容器
- `TaskForest`：某条 Pipeline 在某次运行中展开出的动态任务森林
- `Task`：森林中的任务节点，可绑定 `AgentNode`、`Gate`、`HumanTask`
- `AgentNode`：Task 的执行能力单元

也就是说，后续不是“Pipeline 替代 Governance”，而是“**升级后的 Pipeline 通过 TaskForest 承接不同事务的编排能力**”。

---

## 3. 当前项目已经有的能力

当前项目并不是从零开始。底层已经有四层能力，只是还没有被抽成统一的智能节点。

### 3.1 Runner 层：已经有可插拔 Runner 注册能力

当前系统已经具备：

- `AgentRunner` 持久化模型，保存 Runner 配置
- `RunnerType` 接口，定义 `createSession / send / output / cancel / destroy`
- `RunnerTypeRegistry` 基于 Nest Discovery 自动注册 Runner Type
- CLI 类 Runner 的公共基座，支持 profile 安装、CLI sessionId 续接、流式解析
- Runner 级 schema 校验、健康检查、运行时参数解析

这意味着“底层执行引擎可插拔”已经具备基础，不需要重做。

### 3.2 Session 层：已经有物理会话、消息、事件、指标持久化

当前系统已经具备：

- `AgentSession` 模型，保存物理会话状态
- `SessionMessage / SessionEvent / SessionMetric / MessageToolUse`
- `SessionsCommandService` 统一创建会话、发消息、取消、重载
- `SessionRuntimeService` 统一消费 Runner 流式输出，并写入消息/事件/指标
- workspace 初始化能力，可克隆 code/doc 仓库，并安装 skill/rule/mcp

这意味着“物理 Agent 会话”已经是一个独立能力域，且可观测性基础不错。

### 3.3 Pipeline 层：已经有线性 Stage、Attempt、租约、人工介入

当前 Plan Pipeline 已经具备：

- `Pipeline / PipelineStage / StageExecutionAttempt / PipelineArtifact / PipelineEvent`
- Worker 轮询 + claim + lease heartbeat
- Stage 级 attempt 记录
- 结构化输出解析与 repair 重试
- 人工 review 暂停点
- 产物版本化与落盘

这意味着“有状态工作流执行”和“失败恢复”也已经有一套初版实现。

### 3.4 Governance 层：已经有领域化 fanout / merge / attempt 能力

当前 Governance 已经具备：

- `GovernanceExecutionAttempt`
- stage 级 `runnerIds + fanoutCount + mergeStrategy`
- baseline / discovery / triage / planning / execution 的领域流程
- 针对 finding / issue / change unit 的 claim + lease + attempt

这意味着“多 Runner fanout、领域任务消费、分布式 lease”这类能力已经被验证过。

---

## 4. 当前架构真正的问题

问题不是“没有能力”，而是“能力分散、抽象错层、重复实现”。

### 4.1 Pipeline 现在仍然是单 Runner、单节点临时配置

当前 Plan Pipeline 的核心限制：

- `Pipeline` 只有一个 `runnerId`
- 只有 `PipelineAgentConfigResolverService` 这一层临时解析入口，但当前执行路径实际传入的是空 stage state
- `PipelineSessionBridgeService` 创建 Session 时始终使用 `pipeline.runnerId`
- 没有节点级 Runner 选择、优先级、条件判断、fallback

本质上，Pipeline 现在仍是“流程持有 Runner”，而不是“节点持有执行策略”。

### 4.2 Session 是物理会话，不是节点会话

当前 `AgentSession` 解决的是底层 Runner 会话问题，但不解决：

- 同一个节点在切换 Runner 后如何保留统一上下文
- 一个节点如何管理多个物理 Session
- 外部流程如何显式复用节点会话
- 节点级统一历史如何跨 Session 聚合

当前模型里，`StageExecutionAttempt.sessionId` 依然是单值，语义还是“这次 attempt 对应一个物理 Session”，不是“一个节点拥有一个可复用的逻辑会话”。

### 4.3 节点记忆没有独立模型

当前记忆分散在三类地方：

- Session 消息历史
- Pipeline runtime JSON
- Governance attempt 的 inputSnapshot / parsedOutput

问题在于：

- 没有统一的节点记忆事实来源
- 换 Session、换 Runner、错误恢复时没有标准 handoff memory
- 当前 repair 只是补一条 follow-up prompt，不是真正可恢复的节点记忆机制

### 4.4 Governance 和 Pipeline 各自实现了一套 Agent 编排

现在存在两条平行路线：

- Pipeline: `PipelineWorkerService + PipelineSessionBridgeService + StageExecutionAttempt`
- Governance: `GovernanceAutomationService + GovernanceRunnerBridgeService + GovernanceExecutionAttempt + Fanout`

二者重复实现了：

- 创建 Session
- 等待结果
- 解析输出
- attempt 生命周期
- lease 与恢复

但能力又不对齐：

- Pipeline 有 artifact / human review，但没有 fanout
- Governance 有 fanout，但没有节点级 skill/rule/mcp/session 策略

这是当前最核心的架构债。

### 4.5 Pipeline 当前是线性状态机，不支持并发

当前 Plan Pipeline 的运行核心仍然是：

- `Pipeline.state.currentStageKey`
- Worker 一次 claim 整条 pipeline
- 按固定顺序推进 `breakdown -> evaluation -> spec -> estimate -> human_review`

这决定了：

- 并发粒度是 pipeline，不是 node
- DAG 不存在
- ready 节点不能并发执行
- pipeline 编排能力无法泛化到 Governance 拆分后的多流程组合

### 4.6 可观测性仍然偏“底层流式日志”，缺少节点语义

当前可观测性主要在：

- session 事件
- session message
- tool use
- pipeline event
- governance attempt

但缺少“智能节点语义”：

- 为什么选了这个 runner
- 为什么 fallback 到下一个 runner
- 当前节点复用了哪个逻辑会话
- 当前记忆快照是什么版本
- 节点失败属于解析失败、平台失败、策略失败还是领域失败

---

## 5. 设计目标

目标不是再给 Pipeline 或 Governance 各补一个功能，而是抽出统一的智能节点运行层。

### 5.1 必须达成的目标

1. AgentNode 必须有独立模型和独立仓储
2. 节点级支持 rule / mcp / skill / prompt / output contract 配置
3. 节点级支持多个 Runner，带条件选择和优先级 fallback
4. 节点有完整记忆，且记忆在切 Session / 切 Runner / 错误恢复时可继续使用
5. 外部流程可以显式控制节点逻辑会话的新建和复用
6. 一个节点逻辑会话下可以有一对多物理 Session 历史
7. 有完整生命周期和审计事件
8. Pipeline 调度支持并发
9. Pipeline 内部必须显式引入 TaskDAG，原生支持动态扇出与聚合，不被静态 DAG 限死
10. 不做跨节点记忆共享，但必须支持大上下文按引用传递
11. 非幂等工具调用必须具备防重放保护
12. 人工介入必须支持显式挂起与异步唤醒
13. 注册方式需要灵活可拔插

### 5.2 明确的非目标

本期不做：

- 跨节点共享会话或共享记忆
- 让 Session 模块直接承担 Pipeline 编排职责
- 保留现有 Governance 作为长期编排中心
- 保留旧 Pipeline / Governance bridge 的兼容层
- 维护新旧双轨运行的长期过渡态

---

## 6. 目标架构

目标架构建议拆成五层：

```text
RunnerType
  ↓
AgentSession（物理会话）
  ↓
AgentNodeConversation（节点逻辑会话）
  ↓
AgentNodeRuntime（节点执行、记忆、fallback、生命周期）
  ↓
PipelineRuntime（TaskDAG 调度、并发、节点依赖）
```

### 6.1 分层职责

#### RunnerType

负责“怎么和具体 Agent 平台交互”。

#### AgentSession

负责“某个 Runner 上的一次物理会话”。

#### AgentNodeConversation

负责“某个节点逻辑会话”的统一历史、统一记忆和多物理 Session 关联。

#### AgentNodeRuntime

负责：

- 选择 Runner
- 准备节点输入
- 组装记忆
- 创建或复用逻辑会话
- 驱动物理 Session
- 解析输出
- fallback / repair / 恢复
- 记录节点生命周期事件

#### PipelineRuntime

负责：

- TaskDAG 调度
- ready node 并发 claim
- Map-Reduce 式动态孵化与聚合屏障
- 聚合节点结果
- 控制节点间依赖

Pipeline 不再直接操作 Runner，也不再自己实现 Session bridge。

其中：

- Pipeline 是运行容器
- TaskDAG 是编排内核
- AgentNodeRuntime 是 DAG 中任务节点的执行引擎

---

## 7. AgentNode 独立模型与仓储

这是本方案的核心。

### 7.1 建议新增的核心模型

#### AgentNodeDefinition

描述一个可复用的智能节点定义。

建议字段：

- `id`
- `name`
- `code`
- `description`
- `nodeKind`
- `inputSchema`
- `outputSchema`
- `memoryStrategy`
- `sessionStrategy`
- `runnerStrategy`
- `resourcePolicy`
- `sideEffectPolicy`
- `promptTemplate`
- `enabled`
- `version`

#### AgentNodeRun

描述某次节点执行实例。

建议字段：

- `id`
- `scopeId`
- `pipelineRunId`
- `pipelineNodeId`
- `agentNodeId`
- `agentNodeVersion`
- `status`
- `suspendReason`
- `inputPayload`
- `resolvedConfigSnapshot`
- `conversationId`
- `currentAttemptNo`
- `resultPayload`
- `failureCode`
- `failureMessage`
- `startedAt`
- `finishedAt`

#### AgentNodeAttempt

描述某次具体尝试。

建议字段：

- `id`
- `nodeRunId`
- `attemptNo`
- `status`
- `runnerCandidateId`
- `runnerId`
- `selectionReason`
- `fallbackFromAttemptId`
- `sessionId`
- `requestMessageId`
- `memorySnapshotId`
- `completedSideEffects`
- `candidateOutput`
- `parsedOutput`
- `failureCode`
- `failureMessage`
- `ownerLeaseToken`
- `leaseExpiresAt`
- `startedAt`
- `finishedAt`

#### AgentNodeConversation

节点逻辑会话，不等于当前 `AgentSession`。

建议字段：

- `id`
- `scopeId`
- `agentNodeId`
- `status`
- `externalKey`
- `latestSummary`
- `pinnedMemory`
- `lastRunnerId`
- `createdAt`
- `updatedAt`

#### AgentNodeConversationMessage

节点逻辑会话的统一时间线。

建议字段：

- `id`
- `conversationId`
- `sessionId`
- `sessionMessageId`
- `role`
- `messageType`
- `summaryText`
- `contentRef`
- `createdAt`

#### AgentNodeMemorySnapshot

节点执行时的可恢复记忆快照。

建议字段：

- `id`
- `conversationId`
- `nodeRunId`
- `attemptId`
- `memoryKind`
- `content`
- `version`
- `createdAt`

#### AgentNodeEvent

节点语义级事件流。

建议字段：

- `id`
- `nodeRunId`
- `attemptId`
- `eventType`
- `timestampMs`
- `data`

### 7.2 仓储边界

建议新增独立仓储：

- `AgentNodeRepository`
- `AgentNodeRuntimeRepository`
- `AgentNodeConversationRepository`
- `AgentNodeMemoryRepository`
- `AgentNodeEventRepository`

原因很直接：

- 不能继续把节点运行细节塞进 `PipelineRepository`
- 也不能继续复用 Governance 的领域仓储来承载通用节点运行
- 节点运行是独立能力域，必须有自己的仓储边界

### 7.3 关键状态约束

建议显式约束以下事实：

- `AgentNodeRun` 是逻辑执行实例，允许多个 `AgentNodeAttempt`
- `AgentNodeAttempt` 是可 claim 的最小分布式执行单元
- `AgentNodeConversation` 是逻辑会话容器，可挂多个 `AgentSession`
- `AgentNodeConversationMessage` 对底层 `SessionMessage` 采用软引用优先，不复制大文本
- 大体量输入输出默认走 `artifact ref`，而不是把全文塞进 run 表

### 7.4 Pipeline / TaskDAG 模型边界

为了保留 Governance 的编排能力，建议在 Pipeline 域内增加以下模型分层：

- `PipelineDefinition`
- `TaskDAGDefinition`
- `TaskNodeDefinition`
- `PipelineRun`
- `TaskDAGRun`
- `TaskNodeRun`

职责边界：

- `PipelineDefinition`：业务流程入口定义，例如 Governance Discovery Pipeline
- `TaskDAGDefinition`：该 Pipeline 对应的任务图定义
- `TaskNodeDefinition`：图中的任务节点定义，可绑定 `AgentNode`、`Gate`、`HumanTask`
- `PipelineRun`：一次流程运行容器
- `TaskDAGRun`：一次任务图实例
- `TaskNodeRun`：图中的最小调度单元

后续 `PipelineNodeRun` 可以直接收敛为 `TaskNodeRun`，避免“Pipeline 节点”和“DAG 节点”双概念长期并存。

---

## 8. 节点配置模型

### 8.1 节点级资源配置

节点应直接持有：

- `skillIds`
- `ruleIds`
- `mcps`
- `workspacePolicy`
- `runnerSessionConfig`
- `runtimeConfig`

这部分配置应该归属 `AgentNodeDefinition.resourcePolicy`，而不是临时塞进 stage state。

建议至少包含：

```ts
type AgentNodeResourcePolicy = {
  workspaceIsolation: 'READ_ONLY' | 'CLONE_PER_RUN' | 'EXCLUSIVE_LOCK'
  systemSummarizerId?: string
  rateLimitGroup?: string
  largePayloadMode: 'INLINE' | 'REFERENCE_ONLY'
}
```

语义：

- `READ_ONLY`：多个分析节点可共享只读工作区
- `CLONE_PER_RUN`：每个 node run 使用独立沙盒，适合会修改文件的执行节点
- `EXCLUSIVE_LOCK`：必须对指定仓库资源加互斥锁，获取不到则排队
- `systemSummarizerId`：主 Runner 失效后的旁路兜底摘要模型
- `rateLimitGroup`：用于限制同一类外部平台并发，避免打满 429
- `largePayloadMode`：大输入默认只传引用，不做 payload 拷贝

### 8.2 多 Runner 候选与 fallback

建议 `runnerStrategy` 支持一个有序候选列表：

```ts
type AgentNodeRunnerCandidate = {
  id: string
  runnerId: string
  priority: number
  when?: Record<string, unknown>
  runnerSessionConfig?: Record<string, unknown>
  runtimeConfig?: Record<string, unknown>
  fallbackOn: string[]
}
```

行为规则：

1. 先按 `when` 过滤候选
2. 再按 `priority` 排序
3. 首选 runner 失败后按 `fallbackOn` 或优先级回退
4. 每次选择都写入 `selectionReason`

这里的条件只依赖：

- 节点输入
- 节点定义
- 当前 attempt 上下文
- 上一次失败码

不依赖跨节点状态。

### 8.3 Session 策略

节点定义必须声明：

- 默认新建逻辑会话还是复用逻辑会话
- 切换 Runner 时是否允许复用已有逻辑会话
- repair 是否必须沿用当前物理 Session
- 失败后 fallback 是复用旧 conversation 还是开新 conversation

建议抽象：

```ts
type AgentNodeSessionPolicy = {
  defaultMode: 'new' | 'reuse'
  allowReuseAcrossRuns: boolean
  allowMultiSessionPerConversation: boolean
  switchRunnerKeepsConversation: boolean
  repairUsesSamePhysicalSession: boolean
}
```

### 8.4 副作用策略

节点定义还应声明对非幂等动作的保护策略。

建议抽象：

```ts
type AgentNodeSideEffectPolicy = {
  enableReplayGuard: boolean
  nonIdempotentToolPatterns: string[]
  checkpointAfterToolSuccess: boolean
}
```

语义：

- 成功执行高风险工具后立刻记录执行水位线
- fallback / repair 时自动注入“已执行副作用”事实约束
- 工具层可基于 `nodeRunId / attemptId` 做 anti-replay 拦截

---

## 9. 节点记忆模型

节点记忆是这次抽象的重点。没有节点记忆，所谓“智能节点”仍然只是换皮 Session。

### 9.1 记忆分层

建议把记忆分成四层：

#### 运行记忆

本次 run 的输入、最近上下文、上次失败、当前产物引用。

#### 会话记忆

逻辑会话的摘要、已确认事实、约束、待办、人工备注。

#### 恢复记忆

给错误恢复 / session 切换 / runner fallback 用的 handoff packet。

#### 产物记忆

节点历史结构化输出、关键 artifact 摘要、重要工具调用结果。

### 9.2 记忆事实来源

节点记忆不应直接从“所有 SessionMessage 全量回放”临时拼接。  
推荐事实来源：

- `AgentNodeConversation.latestSummary`
- `AgentNodeMemorySnapshot`
- 当前 `AgentNodeRun.inputPayload`
- 最近成功 `parsedOutput`
- 最近失败 attempt 的错误上下文

SessionMessage 仍是原始审计日志，但不应该是恢复时唯一事实来源。

### 9.3 切 Session / 切 Runner 时的 handoff

当节点需要从 Session A 切到 Session B，或者从 Runner X 切到 Runner Y 时，不能依赖“失效中的原 Runner 自己写总结”。  
正确做法是：优先使用确定性快照，其次使用旁路系统摘要。

建议机制：

1. 正常运行中持续做增量 checkpoint
2. 每次高价值 Tool Call 成功后立刻追加记忆快照
3. 主 Runner 崩溃时，停止等待原会话自我总结
4. 若已有快照不足，再调用 `systemSummarizerId` 对“历史快照 + 残留流日志 + 错误码”做旁路摘要

最终生成的 handoff memory 至少应包含：

- 当前目标
- 已知约束
- 已完成事项
- 最近失败原因
- 不能重复做的动作
- 最近一次结构化输出
- 需要延续的人工评论

这个 handoff 作为新的 memory snapshot 写库，而不是仅靠 prompt 里“顺手补一句”。

### 9.4 明确不做跨节点记忆

本方案不支持节点 A 与节点 B 共享会话记忆。  
节点间只通过：

- pipeline artifact
- pipeline node output
- 领域对象

进行传递。

这样做的好处是：

- 边界清楚
- 并发简单
- 恢复容易
- 避免节点间上下文污染

### 9.5 节点间大上下文只读引用传递

“不共享记忆”不等于“复制全文输入”。

对于大文本、大 JSON、长报告、代码扫描结果，节点间应默认使用只读引用传递，例如：

- `artifact://pipeline-node-a/analysis.json`
- `artifact://pipeline-node-b/prd.md`

下游节点在 `hydrating_memory` 阶段解析这些引用，并按需摘取摘要或局部内容。  
这样既保留节点边界，又避免：

- run 表 payload 膨胀
- 数据库双写
- 大模型上下文浪费

---

## 10. 外部流程可控的 Session 新建与复用

当前外部流程只能“创建一个物理 Session”，还不能“控制节点逻辑会话”。

目标是把控制权提升一层。

### 10.1 外部调用接口建议

Pipeline 或其他编排方在启动节点时应显式给出：

```ts
type AgentNodeConversationCommand =
  | { mode: 'new' }
  | { mode: 'reuse_by_id'; conversationId: string }
  | { mode: 'reuse_by_key'; externalKey: string }
```

语义：

- `new`: 新建逻辑会话
- `reuse_by_id`: 显式复用已有逻辑会话
- `reuse_by_key`: 用业务键幂等复用，例如 `scopeId + issueId + nodeCode`

### 10.2 一对多物理 Session 历史

一个 `AgentNodeConversation` 下可以有多条 `AgentSession`：

- 初始执行一个 session
- repair 继续沿用同 session
- Runner fallback 新开另一个 session
- 平台异常后新建第三个 session

但这些都应该在同一个逻辑会话下可追踪。

### 10.3 会话恢复与挂起恢复

如果节点因为人工介入或外部系统授权而暂停，恢复时必须优先复用同一个 `AgentNodeConversation`，并根据策略决定：

- 是否继续绑定原物理 Session
- 是否切换到新物理 Session
- 是否切换 Runner 但保留会话级记忆

---

## 11. 完整生命周期

建议把智能节点生命周期标准化为：

1. `created`
2. `queued`
3. `resolving_config`
4. `resolving_conversation`
5. `hydrating_memory`
6. `selecting_runner`
7. `creating_or_binding_session`
8. `sending`
9. `streaming`
10. `suspended`
11. `repairing`
12. `fallback_switching_runner`
13. `succeeded`
14. `failed`
15. `cancelled`
16. `terminated_by_policy`

每个阶段都写 `AgentNodeEvent`。

### 11.1 SUSPENDED 挂起态

当节点在以下场景需要等待外部输入时，不应占着 Worker 死等：

- 人工审批
- 外部授权
- 配额恢复
- 依赖系统异步回调

此时应：

1. 将 `AgentNodeRun.status` 转为 `SUSPENDED`
2. 写入 `suspendReason`
3. 主动释放 attempt lease 与 worker 占用
4. 等待外部事件将其重新置回 `QUEUED`

恢复后由新的空闲 Worker 重新 claim，并通过 `conversationId` 继续执行。

### 11.2 失败类型建议标准化

至少区分：

- `RUNNER_UNAVAILABLE`
- `SESSION_CREATE_FAILED`
- `SESSION_TIMEOUT`
- `SESSION_PLATFORM_ERROR`
- `OUTPUT_PARSE_FAILED`
- `OUTPUT_CONTRACT_VIOLATION`
- `WORKSPACE_LOCK_UNAVAILABLE`
- `POLICY_BLOCKED`
- `MEMORY_HYDRATION_FAILED`
- `SIDE_EFFECT_REPLAY_BLOCKED`
- `FALLBACK_EXHAUSTED`
- `MANUAL_TERMINATED`

这样 Pipeline 和上层业务才能做稳定决策。

---

## 12. 可观测性设计

### 12.1 节点级指标

建议至少统计：

- node run 总耗时
- attempt 次数
- fallback 次数
- session 复用率
- session 切换次数
- parse failure 率
- runner failure 率
- token / cost
- tool use 数量
- memory snapshot 大小

### 12.2 节点级事件

建议有标准事件：

- `node_run_created`
- `conversation_resolved`
- `memory_snapshot_created`
- `runner_selected`
- `runner_fallback_triggered`
- `workspace_lock_waiting`
- `session_bound`
- `message_sent`
- `output_completed`
- `parse_failed`
- `repair_sent`
- `node_run_suspended`
- `node_run_resumed`
- `attempt_succeeded`
- `attempt_failed`
- `node_run_completed`

### 12.3 追踪链路

建议所有事件都可串起：

- `pipelineRunId`
- `pipelineNodeRunId`
- `agentNodeRunId`
- `agentNodeAttemptId`
- `conversationId`
- `sessionId`
- `sessionMessageId`

这会显著优于当前分散在 session/pipeline/governance 三套表里的追踪方式。

---

## 13. Pipeline / TaskDAG 编排设计

这是智能节点抽象落地后的直接收益点。

### 13.1 当前问题

当前 pipeline claim 粒度是整条 pipeline。  
这只适合线性流程，不适合 DAG 和并发，也承接不了 Governance 的复杂编排。

### 13.2 目标设计

Pipeline 应改为 TaskDAG 驱动的运行容器，核心对象建议为：

- `PipelineDefinition`
- `TaskDAGDefinition`
- `TaskNodeDefinition`
- `PipelineRun`
- `TaskDAGRun`
- `TaskNodeRun`

执行粒度从“claim 整条 pipeline”改为“claim ready 的 task node run”。

此外，`TaskNodeDefinition` 不能只支持静态 DAG，还要支持 Governance 需要的动态控制流。

建议节点类型至少包含：

- `TASK`
- `GATE`
- `MAP_REDUCE`

其中 `MAP_REDUCE` 需要声明：

- `iteratorPath`：指向上游输出中的数组路径
- `itemInputBuilder`：如何把数组元素映射为子节点输入
- `mergePolicy`：全部成功、允许部分成功、或自定义聚合

运行时语义：

1. 上游节点产出数组
2. 调度器按数组长度动态孵化 N 个 `TaskNodeRun`
3. 所有子 run 完成后进入 merge barrier
4. 聚合结果后再继续流转

这才足以替代当前 Governance 中数据驱动的 fanout 语义。

### 13.2.1 为什么必须是 TaskDAG

Governance 之所以不能退回线性 Pipeline，是因为它天然需要以下能力：

- Discovery 后按 Issue / Finding 动态分裂任务
- 局部成功、局部失败后的聚合判断
- Human review 作为图上的显式阻塞节点
- Planning -> Execution -> Verification 的多阶段分支与回流

这些都属于 TaskDAG 语义，而不是简单的“多节点并发”。

### 13.3 并发原则

- 依赖满足的节点可以并发运行
- 每个 task node run 独立 lease
- pipeline 只做聚合状态判断
- 节点间不共享会话记忆
- 节点间只传结构化输出 / artifact / 领域引用
- 并发前必须满足物理资源策略，不允许多个写节点踩同一工作区

这正好契合“Pipeline 需要并发，但不需要跨节点”的要求。

### 13.4 对当前实现的影响

当前 `Pipeline.state.currentStageKey` 的线性推进模型，后续应逐步下沉为：

- PipelineRun 维护全局运行容器状态
- TaskDAGRun 维护图级运行状态与屏障状态
- TaskNodeRun 维护任务级执行状态
- AgentNodeRuntime 维护单节点执行细节

也就是说，Pipeline 不再关心“怎么选 Runner、怎么修复 parse、怎么换 session”，它只关心节点是否成功、失败、等待人工、或者产出哪个结果。

### 13.5 工作区隔离与资源锁

并发调度不能只看逻辑依赖，还要看物理副作用。

调度器在派发 `TaskNodeRun` 前，必须根据 `AgentNodeDefinition.resourcePolicy.workspaceIsolation` 执行以下策略：

- `READ_ONLY`：允许共享只读工作区
- `CLONE_PER_RUN`：为每个 node run 准备独立沙盒
- `EXCLUSIVE_LOCK`：必须先获取 repo 级或路径级互斥锁，拿不到则保持排队

否则即使节点逻辑互不依赖，也会在本地 git/workspace 层面互相踩踏。

---

## 14. Governance 的处理建议

当前 Governance 更像一个阶段性中间产物，不应继续作为长期的编排中心。

### 14.1 为什么说它不合理

因为它同时承担了三类职责：

1. 领域对象管理：Finding / Issue / ChangePlan / ChangeUnit
2. 策略配置：priority / auto action / delivery / source selection
3. Agent 编排运行时：runner 选择、fanout、attempt、session bridge、repair

其中第 3 类职责，本质上不应该属于 Governance 领域模块，而应该属于通用智能节点运行层。

### 14.2 后续拆分方向

建议保留领域对象，但拆掉 Governance 专属编排内核。  
后续用多个基于 TaskDAG 的 Pipeline 组合实现：

- Pipeline A: Repository Baseline
- Pipeline B: Discovery
- Pipeline C: Triage
- Pipeline D: Planning
- Pipeline E: Execution
- Pipeline F: Verification / Delivery / Notification

这些 Pipeline 里的 Agent 节点统一走 `AgentNodeRuntime`，图级编排统一走 `TaskDAGRuntime`。

其中 Discovery -> Repair / Planning -> Execution 这类高并发场景，应优先用 `MAP_REDUCE` 控制流承接，而不是再在 Governance 域内重复造 fanout 子系统。

### 14.3 具体要被替换的现有能力

后续可逐步废弃：

- `GovernanceRunnerBridgeService`
- `GovernanceRunnerResolverService`
- `GovernanceAgentFanoutService`
- `GovernanceAutomationAttemptService`
- `GovernanceAutomationService` 中与通用 Agent 运行相关的部分

保留或下沉的部分：

- 领域实体与领域仓储
- policy evaluator
- prompt builder 中真正领域相关的部分

---

## 15. 可拔插注册设计

当前项目已经有一个好的起点：`RunnerTypeRegistry`。  
智能节点层建议沿用同样思路继续往上抽。

### 15.1 建议新增的注册点

- `AgentNodeKindRegistry`
- `AgentNodeMemoryProviderRegistry`
- `AgentNodeRunnerSelectorRegistry`
- `AgentNodeOutputParserRegistry`
- `AgentNodeLifecycleHookRegistry`
- `AgentNodeSideEffectGuardRegistry`
- `WorkspaceLockProviderRegistry`

### 15.2 设计原则

- 节点定义是数据化配置
- 节点行为是可注册扩展
- 运行时编排由统一引擎驱动
- 领域只注册自己的 prompt builder / parser / memory provider / side effect handler

这样未来不管是 Plan、Review、Discovery、Planning、Execution，还是新的业务流程，都不需要再复制一套 bridge service。

---

## 16. 推荐迁移路径

建议分四步迁移，且默认按新单一契约直接切换，不设计兼容层。

### Phase 1：先抽通用 AgentNodeRuntime

先不改 Pipeline DAG，只做：

- 新增 AgentNode 定义、run、attempt、conversation、memory、event 模型
- 把 Runner 选择、Session 绑定、repair、fallback、生命周期事件统一收口
- 让现有 Plan Pipeline 的 agent stage 先改走 AgentNodeRuntime
- 删除 Pipeline / Governance 中已被替代的通用 bridge 入口，不保留兼容 facade

### Phase 2：让 Pipeline 从线性 stage 过渡到 node run

- 新增 `PipelineNodeRun`
- 把 claim 粒度从 pipeline 移到 node run
- 在 ready node 上支持并发
- 引入 `MAP_REDUCE` 和 merge barrier
- 引入 workspace isolation 与资源锁
- `Pipeline.state.currentStageKey` 不再作为长期主模型，迁移后直接以下一代 node run / DAG 模型为准

### Phase 3：Governance 迁移到多个 Pipeline

- 领域对象继续复用
- Governance 编排逻辑迁出
- 由多个 Pipeline 组合替代单体 Governance automation
- 迁移完成后，新链路成为唯一写路径，不保留旧 Governance automation 作为 fallback

### Phase 4：清理旧桥接层

- 删除 Pipeline / Governance 自带的 runner bridge
- 删除重复 attempt 模型
- 删除只为中间过渡存在的治理编排逻辑
- 删除旧 runtime contract、旧状态字段和兼容 DTO，避免系统长期停留在双语义状态

---

## 17. 结论

当前项目已经具备 Runner、物理 Session、基础 Pipeline、分布式 lease、以及 Governance fanout 的零散能力；真正缺的是一个位于 Session 之上、Pipeline 之下的统一智能节点运行层。

这个运行层必须把以下能力收敛到一个独立能力域：

- 节点定义
- Runner 选择与 fallback
- 逻辑会话
- 节点记忆
- Attempt 生命周期
- 可观测性

在这个前提下：

- Pipeline 才能真正并发
- 节点才能真正复用
- 切 Session / 切 Runner / 错误恢复才有稳定语义
- Governance 才能被拆回多个 Pipeline 组合，而不是继续维护一套领域专属编排内核

---

## 附：当前项目实现映射

当前文档对应的代码落点如下：

- Runner 注册与底层执行：`packages/backend/src/modules/agent-runners`
- 物理 Session 与流式事件：`packages/backend/src/modules/sessions`
- 当前线性 Pipeline：`packages/backend/src/modules/pipelines`
- 当前 Governance 自动化：`packages/backend/src/modules/governance`
- 共享类型与 schema：`packages/shared/src/types`、`packages/shared/src/schemas`
- 持久化模型：`packages/backend/prisma/schema.prisma`

其中几个关键事实：

- 当前 Runner 已支持自动注册和 schema 驱动配置
- 当前 Session 已支持 skill / rule / mcp 注入与事件持久化
- 当前 Pipeline 已支持 attempt、lease、repair、human review
- 当前 Governance 已支持 runner fanout，但仍是领域专用编排，不是通用节点运行层
