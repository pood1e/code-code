# 半自动持续优化循环 — 设计方案（修订定稿）

> 状态：待评审  
> 版本：v3.2（深水区修订：并发防脑裂 / 租约防死锁 / 产物指针防熔断 / 消除双写 / 审计闭环）  
> 关联：[multi-agent-tdd-pipeline.md](./multi-agent-tdd-pipeline.md)

---

## 变更记录（v2 → v3）

| 章节 | 修订内容 |
> **v3.1 追加修订（基于 GPT review）**
|---|---|
| §6 PipelineRuntimeState | 移除 `stageCursor.stageId`，改为 `currentAttemptNo`，消除双重定位风险 |
| §6 retryBudget | breakdown budget 细化为 `agentFailureCount` + `evaluationRejectCount` 双计数器 |
| §6.2 新增 | 补全 `PlanReport` 类型定义 |
| §5.2 / §19.3 StageExecutionAttempt | 新增 `activeRequestMessageId`、`ownerLeaseToken` 字段；删除冗余 `pipelineId`（通过 `stage.pipelineId` 反查）；`correlationKey` 生成规则明确为 `sha256(stageId:attemptNo)` |
| §9.3 消息检索规则 | 补充 WAITING_REPAIR 期间 `activeRequestMessageId` 更新与崩溃恢复协议 |
| §12.1 inputSnapshot | 明确写入时机为发送前，上下文升级时覆盖写入，增加 contextLevel 字段建议 |
| §14.3 stale 判定 | 推荐 `ownerLeaseToken` 乐观锁方案，明确 fallback 方案已知风险并要求技术债标注 |
| §16.1 breakdown | 明确 evaluation reject 与 agent failure 的 attempt 语义差异与 budget 扣减规则 |
| §17.3 edit_and_continue | 补充 schema 校验失败时的处理路径（返回错误、保持编辑态，不自动循环） |
| §17.4 推荐动作矩阵 | 改为表格，补充 MANUAL_ESCALATION 的 sourceStageKey 确定规则与动作集合 |
| §19.2/19.3 Schema | 补充 `@relation` 外键关联与 `onDelete: Cascade` 策略 |

> **v3 → v3.1 追加修订（归档）**

| §13.2 原子提交 | `stageCursor = null` 残留改为 `currentAttemptNo = null`，消除文档内自相矛盾 |
| §16.1 breakdown | evaluation reject 统一为**新建 attempt**，与 agentFailure 语义一致，保证审计完整性 |
| §5.2 + §19.3 | `StageExecutionAttempt` 两处定义均补齐 `ownerLeaseToken`，确认为正式 schema 字段 |
| §5.2 + §19.3 | 删除冗余 `pipelineId` 字段，改为通过 `stage.pipelineId` 反查；`correlationKey` 生成规则同步改为 `sha256(stageId:attemptNo)` |

> **v3.1 → v3.2 追加修订（基于 Gemini 深水区并发架构推演）**

| 优先级 | 章节 | 修订内容 |
|---|---|---|
| P0 防脑裂 | §5.1 / §13.2 / §19.2 | `Pipeline` 主表引入 `version` 乐观锁；原子写回改为 `UPDATE WHERE version=expected`，version mismatch 时 Worker 安全退出 |
| P0 防死锁 | §5.3 / §14.3 / §19.3 | `ownerLeaseToken` 增加 `leaseExpiresAt` TTL，Worker 持有锁期间持续心跳续约，OOM/宕机后 1~2 分钟自动释放供他人接管 |
| P0 消除双写 | §4.2 / §6 / §13.1 | 从 `Pipeline.state` 删除 `currentAttemptNo`；Worker 推进时通过 DB 查询 `SELECT ... ORDER BY attemptNo DESC LIMIT 1` 动态推导当前 attempt，实现零歧义单一事实来源 |
| P1 防熔断 | §4.3 / §10 | PRD/Spec 等长文本产物改为**产物指针模式**：Agent 写 doc 文件，`json:pipeline-output` 只返回路径与摘要；PlanReport 仍全量输出 |
| P1 防遗忘 | §6 / §16.1 | `breakdownFeedback` 升级为 `breakdownRejectionHistory: string[]`，全量保留历次 evaluation reject 原因，防止单值覆盖导致大模型遗忘前轮教训 |
| P1 防幻觉 | §9.3 | WAITING_REPAIR 崩溃恢复时，禁止盲目重发修正消息；必须先拉取 Session 最新消息比对，确认未发送才下发，避免重复指责诱发幻觉 |
| P2 审计闭环 | §14.1 / §17.3 | 新增 `RESOLVED_BY_HUMAN` Attempt 状态；`edit_and_continue` 成功后将原 attempt 标记为该状态，确保 SFT 语料库 100% 纯净度 |
| P2 预算重置 | §17.3 | 人工从 `human_review` 触发 `retry` 时，必须重置目标 Stage 的 retry budget 计数器，释放完整重试空间 |
| P2 幂等简化 | §5.3 / §9.2 / §19.3 | `correlationKey` **彻底删除**（Schema 字段、§5.2 说明、`StageRunEnvelope` 注入三处全部清除），直接依赖 `@@unique([stageId, attemptNo])` + DB 动态推导保证幂等 |

> **v3.2 术语统一清理（基于 GPT 第二轮 review）**

| 章节 | 清理内容 |
|---|---|
| §6.1 | 删除"现改为只保留 `currentAttemptNo`"旧表述，改为准确描述 v3.2 的 DB 动态推导策略 |
| §16.1 | 删除 `currentAttemptNo = null` 两处残留，改为 Worker DB 查询描述 |
| §16.1 / §22.2 | `breakdownFeedback` 全部替换为 `breakdownRejectionHistory.push(reason)` |
| §6 artifacts | `prd` / `acSpec` 类型更新为 `T \| ArtifactRef \| null`，与 §10.0 产物指针模式对齐 |
| §6.2 新增 | `ArtifactRef` 类型定义，包含 `filePath` + `summary`，明确 union discriminant 判断规则 |
| §9.2 StageRunEnvelope | `correlationKey` 从 envelope 定义和 prompt 注入中彻底移除 |

---

## 1. 文档目的

本文档定义 Plan Pipeline 接入真实 AgentSession 的完整设计方案，用于替换当前 `breakdown`、`spec`、`estimate` 三个 mock Agent Stage，使其具备真实推理、结构化输出、失败恢复、人工接管、可审计与可观测能力。方案以最小侵入方式复用现有 Session 基础设施，并保持当前 PipelineWorker 驱动模式不变。

本文档同时解决原方案中尚未完全闭合的几个问题：

- Pipeline 运行态与 Stage 记录的双写一致性
- 一个 Stage 多次执行的审计与恢复
- Session 超时、Worker 崩溃、重复 claim 的幂等处理
- Agent 输出结构化结果的归一化协议
- `human_review` 从“暂停点”升级为“可恢复节点”
- doc workspace 副作用与状态推进之间的边界

---

## 2. 背景与现状

### 2.1 当前系统关键概念

现有系统已具备如下核心模型与职责边界：

- **AgentRunner**：全局资源，描述 LLM 运行器配置，不属于任何 Project
- **Skill / Rule / MCP**：全局能力资源，可被 Session 组合使用
- **Profile**：Skill + Rule + MCP 的命名组合预设
- **Project**：项目作用域容器，持有 `gitUrl`、`workspacePath`、`docSource`
- **AgentSession**：一次 Agent 调用会话，属于 Project
- **Pipeline**：一条含多个 Stage 的执行流程，由 `PipelineWorkerService` 驱动
- **PipelineStage**：Pipeline 中的一个执行单元，当前已有 `sessionId` 字段但未被真实使用
- **Pipeline.state**：以 JSON 存储的运行时状态，跨 Step 传递产物与反馈

### 2.2 当前 Plan Pipeline 流程

当前 Plan Pipeline 的逻辑顺序为：

```text
breakdown -> evaluation -> spec -> estimate -> human_review -> complete
```

其中：

- `breakdown`：mock，生成硬编码 PRD
- `evaluation`：已实现，校验粒度并决定是否重试
- `spec`：mock，生成硬编码 AC Spec
- `estimate`：mock，生成硬编码估算报告
- `human_review`：已实现，暂停等待人工决策

### 2.3 当前方案存在的问题

虽然原始方案已经明确要将三个 Agent Stage 改为真实 Session 调用，并将 agent 配置下沉到 Stage 级值对象，这个方向是正确的，但仍存在以下缺口：

1. `Pipeline.state` 与 `PipelineStage` 可能同时承载运行语义，事实来源不唯一
2. `PipelineStage.sessionId` 单值字段无法表达多次重试、多次 attempt
3. “返回最后一条 assistant 消息”不足以作为稳定结果判定
4. 结构化输出缺少 canonical output 定义
5. Worker 崩溃、lease 转移、重复 claim 的恢复逻辑未闭合
6. `human_review` 缺少标准输入、建议动作、恢复协议
7. `planReport` 的产物类型不统一
8. doc workspace 作为副作用与状态推进尚未明确解耦

本修订版将逐项补齐这些设计缺口。

---

## 3. 设计目标

### 3.1 本期目标

本期目标如下：

1. 将 `breakdown`、`spec`、`estimate` 从 mock 替换为真实 AgentSession 调用
2. 继续复用 `SessionsCommandService.create()` 与现有 Session/Runner 体系
3. 在 UI 中可查看每个 Stage 的 Session 与执行历史
4. 支持结构化输出校验、修正、超时、取消与失败恢复
5. 保证分布式 Worker 下的幂等与崩溃恢复能力
6. 默认允许 Plan Pipeline 的 Agent 读写 doc workspace
7. 保持对现有 Project / AgentRunner / Profile 的最小侵入

### 3.2 非目标

本期不包含以下内容：

- 其他 Pipeline（2-6）的接入
- 代码生成类 Pipeline 的 code branch 隔离
- 自动触发下一条 Pipeline
- 多 Agent 协同编排
- doc workspace 的自动 commit / push / branch 管理
- Session 域全面重构为 run-based API

---

## 4. 设计原则

### 4.1 Pipeline.state 配合乐观锁作为宏观事实来源

Worker 推进逻辑只依据 `Pipeline.state` 的核心字段判断当前处于哪个宏观阶段（`currentStageKey` 等）。

**向 DB 提交状态更新时，必须配合全局版本号（`version`）执行乐观并发控制**，防止 Worker 在大模型生成周期（数分钟）内持有旧快照，返回后覆盖掉其他 Worker 或人工操作写入的最新状态（Lost Update / 幽灵覆盖）。

这意味着：

- 当前执行到哪个 Stage，由 `Pipeline.state.currentStageKey` 决定
- 当前 Stage 的产物、反馈、失败原因、人工审批输入，也存于 `Pipeline.state`
- `PipelineStage` 只描述“静态流程定义”
- Stage 的每次具体执行过程由新增的 `StageExecutionAttempt` 模型承载

这样可以避免“Stage 记录说在 A，runtime JSON 说在 B”的双写失真。

### 4.2 Stage 要支持多次 Attempt

一个 Agent Stage 在真实运行中可能：

- 第一次 Session 直接成功
- 在同一 Session 内进行多次格式修正
- Session 超时后新建 Session 重试
- 被人工接管后重跑
- 因 Worker 崩溃而恢复中断执行

因此，设计必须以 **Stage → 多个 Attempt** 为基础，而不是把所有运行信息压在 `PipelineStage.sessionId` 上。

### 4.3 Canonical Output 只能有一个

Agent 可能：

- 在会话消息里输出自然语言 + JSON
- 在 doc workspace 写 PRD / Spec / Report 文件
- 同时输出多个代码块

为了保证状态机稳定，本期明确规定：

> **Stage 的 canonical output 是 assistant 消息中的唯一 `json:pipeline-output` fenced block。**

doc workspace 中的文件仅作为副作用与展示物，不作为推进状态机的事实依据。

### 4.4 资源独占抢占必须具备 TTL（租约过期机制）

严禁使用无超时概念的独占 Token。任何分布式资源抢占（如 Attempt 的 Worker claim）必须带有 `leaseExpiresAt` 超时自动释放字段。Worker 持有期间以心跳持续续约；若 Worker OOM / 宕机，租约自然过期后集群内其他节点可安全接管，彻底避免死锁。

### 4.5 所有跨边界动作都必须可恢复

跨边界动作包括：

- 创建 attempt
- 创建 Session
- 发送首条消息
- 轮询消息结果
- 格式修正
- 取消 Session
- 写入 Pipeline.state

这些动作在任意中间点失败时，都必须能够恢复，不得依赖人工清理脏状态。

### 4.6 human_review 是恢复节点，不是黑洞

进入 `human_review` 后，审批人必须能够看到：

- 从哪个 Stage 失败而来
- 最后一次 attempt 的失败原因
- 历史 attempts 与 Session 链接
- 候选结构化结果
- 系统建议动作

并且可以执行：

- retry
- edit_and_continue
- skip
- terminate

---

## 5. 修订后的核心设计

### 5.1 PipelineStage 保持静态定义职责

`PipelineStage` 只表达流程上的固定阶段定义，不再承载“某次执行用了哪个 Session、失败了几次、当前是否运行中”等动态信息。

建议模型如下：

```prisma
model PipelineStage {
  id           String   @id @default(cuid())
  pipelineId   String
  stageKey     String   // breakdown / evaluation / spec / estimate / human_review / complete
  stageType    String   // agent | gate | human
  orderIndex   Int

  agentConfig  Json?    // Stage 级默认 agent 配置，值对象

  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
```

约束：

- 不再以 `PipelineStage.sessionId` 作为主设计
- 不在 `PipelineStage` 上记录 attempt 状态
- 当前运行位置只看 `Pipeline.state`

### 5.2 新增 StageExecutionAttempt

为承载某个 Stage 的每次具体执行，引入新模型：

```prisma
model StageExecutionAttempt {
  id                  String    @id @default(cuid())
  stageId             String

  attemptNo           Int
  // PENDING | RUNNING | WAITING_REPAIR | SUCCEEDED | FAILED | CANCELLED | ABANDONED | RESOLVED_BY_HUMAN
  status              String

  sessionId           String?
  // 当前正在等待结果的用户消息 id，随每次修正消息原子更新（详见第 9.3 节）
  activeRequestMessageId String?

  // 分布式宕机防死锁机制：Worker claim 时写入 token，同时设置过期时间
  ownerLeaseToken     String?
  leaseExpiresAt      DateTime? // Worker 必须在此时间前心跳续约，过期后其他 Worker 可接管

  resolvedAgentConfig Json?
  inputSnapshot       Json?
  outputSnapshot      Json?
  errorCode           String?
  errorMessage        String?

  parseRepairCount    Int       @default(0)
  startedAt           DateTime?
  finishedAt          DateTime?

  // 关联关系：Stage 删除时级联删除所有 Attempt
  stage        PipelineStage @relation(fields: [stageId], references: [id], onDelete: Cascade)

  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt

  // correlationKey 已移除：在 DB 动态推导 attempt 的前提下，此复合唯一约束已足够防止重复创建
  @@unique([stageId, attemptNo])
}
```

说明：

- `attemptNo`：某 Stage 第几次执行
- `status`：本次执行生命周期状态
- `sessionId`：本次 attempt 实际绑定的 Session
- `correlationKey`：**已移除**。Worker 在 DB 动态推导 attempt 模式下，先 SELECT 确认不存在再 INSERT，`@@unique([stageId, attemptNo])` 复合约束已足以防止重复创建，无需额外 hash 字段
- `leaseExpiresAt`：Worker claim 时设置，心跳循环中定期续约（建议每 60s）；若 Worker OOM/宕机，超时后其他 Worker 通过 `leaseExpiresAt < NOW()` 条件安全接管
- `resolvedAgentConfig`：执行时最终生效的完整配置快照
- `inputSnapshot`：当时送给 Agent 的上下文快照（包含实际使用的上下文层级 L1/L2/L3）
- `outputSnapshot`：结构化产物快照（长文本 stage 存文件指针，短文本 stage 存完整 JSON）
- `parseRepairCount`：同一 attempt 中格式修正次数
- `activeRequestMessageId`：当前正在轮询的用户消息 id，随每次修正消息原子更新（详见第 9 节）
- `ABANDONED`：旧 Worker 遗留 attempt 被新 Worker 判定为废弃（leaseExpiresAt 已过期）
- `RESOLVED_BY_HUMAN`：人工 edit_and_continue 成功后的终态，用于 SFT 语料过滤

### 5.2.1 为什么必须新增 Attempt 模型

这个模型解决了几个关键问题：

1. 审计：可以完整追踪一个 Stage 失败过几次、每次用了哪个 Session
2. 可观测：前端可展示 attempt timeline
3. 恢复：Worker 崩溃后可以接着恢复未完成 attempt
4. 幂等：避免重复创建 Session 或丢失执行记录
5. 人工审批：可以展示“最近一次失败”和“所有历史尝试”

---

## 6. PipelineRuntimeState 设计

保留 `Pipeline.state` 作为 JSON 运行态存储，但调整结构，使其不再混合 attempt 细节与全局计数。

```typescript
type PipelineRuntimeState = {
  /**
   * 当前所处阶段，是唯一的阶段定位依据。
   * Worker 推进逻辑只读此字段判断执行哪个 Stage。
   */
  currentStageKey:
    | 'breakdown'
    | 'evaluation'
    | 'spec'
    | 'estimate'
    | 'human_review'
    | 'complete';

  config: PipelineConfig;

  // ⚠️ currentAttemptNo 已彻底移除：Worker 进入某 stage 后必须通过
  //    SELECT * FROM StageExecutionAttempt WHERE stageId=? ORDER BY attemptNo DESC LIMIT 1
  //    动态推导当前 attempt，实现零歧义单一事实来源（SSOT）。
  //    Pipeline.state 不再持久化任何 attempt 编号。

  retryBudget: {
    /**
     * breakdown 的 retryBudget 区分两种消耗来源：
     * - agentFailure：Session 运行失败 / 超时 / 解析失败导致的重试
     * - evaluationReject：evaluation gate reject 导致的重试
     * 两者共享同一个上限，但分别计数以便审计。
     */
    breakdown: {
      remaining: number;
      agentFailureCount: number;
      evaluationRejectCount: number;
    };
    spec: { remaining: number };
    estimate: { remaining: number };
  };

  artifacts: {
    /**
     * 长文本型 stage（breakdown）产物。
     * 产物指针模式（§10.0）下存储文件引用；若 Agent 直接输出结构体则存完整 PRD。
     * Worker 读取时检查 union discriminant（有 filePath 字段则走 Workspace API 读取，否则直接使用）。
     */
    prd: PRD | ArtifactRef | null;
    /**
     * 长文本型 stage（spec）产物，同 prd 的 union 约定。
     */
    acSpec: TaskACSpec[] | ArtifactRef | null;
    /**
     * 短文本型 stage（estimate）产物，全量内联存储，不使用文件指针。
     * 结构定义见第 6.2 节。
     */
    planReport: PlanReport | null;
  };

  feedback: {
    /**
     * 历次 evaluation reject 的原因列表（全量保留，不覆盖）。
     * 每次 evaluation reject 时 push 新条目，新 attempt 的 prompt 构建时
     * 将全部历史作为 L2 增强上下文喂给 Agent，防止大模型遗忘前轮教训。
     */
    breakdownRejectionHistory: string[];
    humanReview: HumanReviewState | null;
  };

  lastError: {
    stageKey: string | null;
    attemptId: string | null;
    code: string | null;
    message: string | null;
    at: string | null;
  } | null;
};
```

其中人工审批态定义为：

```typescript
type HumanReviewState = {
  reason:
    | 'AGENT_TIMEOUT'
    | 'AGENT_RUNTIME_ERROR'
    | 'PARSE_FAILED'
    | 'MANUAL_ESCALATION'
    | 'EVALUATION_REJECTED';

  sourceStageKey: 'breakdown' | 'spec' | 'estimate' | null;
  sourceAttemptId: string | null;

  summary: string;
  candidateOutput?: unknown;
  suggestedActions: Array<'retry' | 'edit_and_continue' | 'skip' | 'terminate'>;
  reviewerAction?: 'retry' | 'edit_and_continue' | 'skip' | 'terminate' | null;
  reviewerComment?: string | null;
};
```

### 6.1 关键修订点

- 用 `currentStageKey` 替代旧的 `currentStep`
- **移除 `stageCursor`（含 `stageId` 与 `currentAttemptNo`）**：v3.2 进一步将 `currentAttemptNo` 也从 `Pipeline.state` 移除，改为 Worker 运行时通过 DB 动态推导当前 attempt（`SELECT ... ORDER BY attemptNo DESC LIMIT 1`），实现零歧义单一事实来源；`stageId` 通过 `currentStageKey` 查表获得
- **`retryBudget.breakdown` 细化为双计数器**：区分 Agent 失败与 evaluation reject，既共享预算上限，又各自可审计（详见第 16 节）
- `planReport` 统一为结构化对象 `PlanReport | null`（类型定义见第 6.2 节）
- 去掉不适用于多 Stage 的全局 `attempt` / `retryCount`
- 所有失败信息统一进入 `lastError`

### 6.2 ArtifactRef 类型定义

```typescript
/**
 * 长文本产物的文件指针，用于 prd / acSpec 字段。
 * Worker 通过 filePath 调用 Workspace API 读取完整内容后再组装业务结构体。
 * 消费方通过检查是否存在 filePath 字段区分指针模式与内联模式。
 */
type ArtifactRef = {
  filePath: string;   // 相对于 doc workspace 根目录的路径，如 "docs/prd.md"
  summary: string;    // Agent 输出的摘要，用于 human_review 展示，不依赖文件读取
};
```

### 6.3 PlanReport 类型定义

```typescript
/**
 * estimate Stage 的 canonical output 类型。
 * Agent 必须在 json:pipeline-output block 中输出符合此结构的 JSON，
 * 并由 Zod schema 在运行时校验。
 */
type PlanReport = {
  /** 总体估算工时（人天） */
  totalEstimateDays: number;

  /** 置信度，0-1 浮点数 */
  confidence: number;

  /** 每个 Task 的估算明细 */
  taskEstimates: Array<{
    taskId: string;
    title: string;
    estimateDays: number;
    complexity: 'low' | 'medium' | 'high';
    risks: string[];
  }>;

  /** 整体风险说明 */
  overallRisks: string[];

  /** 估算假设前提 */
  assumptions: string[];

  /** 其他备注 */
  notes?: string;
};
```

`PlanReport` 对应的 Zod schema 定义在 `src/schemas/plan-report.schema.ts`，由 `StructuredOutputParser` 在运行时校验。

---

### 7.1 保持 Stage 级配置，但引入解析后的完整配置

原有“配置下沉到 Stage.agentConfig”思路保留，因为不同 Stage 的能力组合确实可能不同。修订点在于：**Stage 上保存的是原始值对象，执行时必须解析成完整配置。**

原始配置：

```typescript
type PipelineAgentConfig = {
  runnerId?: string;
  workspaceResources?: SessionWorkspaceResourceKind[];
  workspaceResourceConfig?: SessionWorkspaceResourceConfig;
  skillIds?: string[];
  ruleIds?: string[];
  mcps?: PlatformSessionMcp[];
  runnerSessionConfig?: Record<string, unknown>;
};
```

执行时解析为：

```typescript
type ResolvedPipelineAgentConfig = {
  runnerId: string;
  workspaceResources: SessionWorkspaceResourceKind[];
  workspaceResourceConfig: SessionWorkspaceResourceConfig;
  skillIds: string[];
  ruleIds: string[];
  mcps: PlatformSessionMcp[];
  runnerSessionConfig: Record<string, unknown>;
};
```

### 7.2 解析规则

执行某 Stage 前，由 `PipelineAgentConfigResolver` 负责：

1. 读取 `PipelineStage.agentConfig`
2. 与系统默认值合并
3. 对 Plan Pipeline 的 Agent Stage 默认补 `workspaceResources: ['doc']`
4. 若未显式指定 runner，则使用 Pipeline 默认 runner
5. 校验 runner、skills、rules、mcps 是否存在且允许被该 Pipeline 使用
6. 产出 `ResolvedPipelineAgentConfig`
7. 将解析结果快照写入 `StageExecutionAttempt.resolvedAgentConfig`

### 7.3 `agentConfig = null` 的规则

当某 Agent Stage 未配置 `agentConfig` 时，不采用“只兜底 runnerId，其余留空”的弱兜底，而是直接解析成完整默认配置：

```typescript
{
  runnerId: pipeline.defaultRunnerId,
  workspaceResources: ['doc'],
  workspaceResourceConfig: {},
  skillIds: [],
  ruleIds: [],
  mcps: [],
  runnerSessionConfig: {},
}
```

这样可以减少隐式空配置导致的灰色故障。

### 7.4 权限与安全约束

由于 Stage 级配置允许注入 MCP 与 runnerSessionConfig，本期必须引入最小安全约束：

- 仅允许使用平台允许的 MCP 类型
- runnerSessionConfig 只允许白名单字段透传
- Pipeline 只能引用有权限的 runner / skill / rule / mcp
- 前端如支持编辑 agentConfig，后端仍需再次校验

---

## 8. PipelineSessionBridgeService 设计

### 8.1 职责定位

`PipelineSessionBridgeService` 不再只是“create + poll”包装层，而是某个 Agent Stage 的执行协调器。职责包括：

1. 解析 Stage 配置
2. 创建或恢复当前 attempt
3. 创建或恢复 Session
4. 发送首条 prompt
5. 轮询本次请求对应的结果
6. 驱动 structured output 解析与修正
7. 返回 canonical output
8. 在 cancel / timeout / 崩溃恢复场景下执行对应补偿动作

### 8.2 执行入口

建议暴露统一接口：

```typescript
executeAgentStage(params: {
  pipelineId: string;
  stageId: string;
  stageKey: 'breakdown' | 'spec' | 'estimate';
  runtimeState: PipelineRuntimeState;
}): Promise<ExecuteAgentStageResult>
```

结果结构：

```typescript
type ExecuteAgentStageResult =
  | {
      kind: 'success';
      attemptId: string;
      output: unknown;
    }
  | {
      kind: 'needs_human_review';
      attemptId: string | null;
      reason: HumanReviewState['reason'];
      summary: string;
      candidateOutput?: unknown;
    }
  | {
      kind: 'retryable_failure';
      attemptId: string;
      code: string;
      message: string;
    };
```

---

## 9. Session 关联与结果获取协议

### 9.1 不再使用“最后一条 assistant 消息”

这是本修订版最重要的改动之一。

“轮询完成后取最后一条 assistant 消息”存在明显问题：

- 同一 Session 内可能有多轮修正
- assistant 可能输出多个消息
- 还可能有系统补充消息或后续用户消息
- 多 Stage 复用同 Session 时更不可靠

因此，本期引入运行内关联协议。

### 9.2 StageRunEnvelope

每次 Stage 执行生成一个 envelope：

```typescript
type StageRunEnvelope = {
  attemptId: string;   // Attempt 的数据库 id，用于消息追踪
  stageKey: string;    // 当前 stage，便于 Agent 理解上下文
  // correlationKey 已彻底移除：不入库，envelope 中也不再注入，
  // 幂等由 @@unique([stageId, attemptNo]) 复合约束 + DB 动态推导保证
};
```

发送给 Session 的首条用户消息中，在 prompt 外层附加：

```text
[PIPELINE_RUN]
attemptId=...
stageKey=...
[/PIPELINE_RUN]
```

### 9.3 本期消息检索规则

若 SessionMessage 暂无原生 request/response 关联，本期最低方案为：

1. 发送 prompt 后记录 `activeRequestMessageId`，写入 `StageExecutionAttempt.activeRequestMessageId`
2. 轮询时只读取 `activeRequestMessageId` 之后的 assistant 消息
3. 截止范围为"下一条用户消息出现之前"
4. 在该消息集合中查找第一个含合法 `json:pipeline-output` 的完成消息
5. 该消息对应的 output 作为 canonical output 来源

**WAITING_REPAIR 期间的 activeRequestMessageId 更新：**

当 attempt 进入 `WAITING_REPAIR` 并发送修正消息时：

1. 修正消息发送完成后，立即将新消息的 id 原子写入 `attempt.activeRequestMessageId`
2. 之后的轮询基于新的 `activeRequestMessageId` 重新定位结果范围
3. 若写入 `activeRequestMessageId` 前 Worker 崩溃，恢复时发现 attempt 处于 `WAITING_REPAIR` 状态：
   - **严禁盲目重发修正消息**（会导致 Agent 收到重复严厉指责，诱发幻觉或拒绝响应）
   - 必须先通过 Session API 拉取该 Session 最近的用户消息内容
   - 检查其是否已包含修正模板标识（如"你上一条回复未满足系统要求"）：
     - **已包含**：说明上代 Worker 已发出但未及写 DB，提取该消息 id 写入 `activeRequestMessageId` 后直接继续轮询
     - **不包含**：确认确实未发送，此时方可发送修正消息

### 9.4 后续演进建议

后续若 Session 域支持 message run / turn id，可将本设计升级为：

- requestMessageId
- responseMessageId
- runId

从而彻底消除基于消息顺序的推断。

---

## 10. Structured Output 设计

### 10.0 产物量级分类（防 Token 熔断）

对产物量级不同的 Stage 执行不同的强制契约，根治大模型 Token 击穿报错：

**长文本型（breakdown → PRD，spec → ACSpec）：**

- Prompt 明确约束：Agent 必须使用文档读写工具，将分析内容写入 doc workspace（`docs/prd.md` / `docs/spec.md`）
- `json:pipeline-output` 只允许返回**状态信号与文件指针**：

```json
{
  "status": "success",
  "artifactFilePath": "docs/prd.md",
  "summary": "需求拆解完成，核心分为鉴权和管理两大模块"
}
```

- Worker 提取 JSON 指针后，主动调用 Workspace API 将文件内容读入内存，组装为业务结构，再写入 `Pipeline.state.artifacts`
- `artifacts.prd` 字段类型相应扩展为 `{ filePath: string; summary: string } | PRD`（向前兼容）

**短文本型（estimate → PlanReport）：**

- 全量在 `json:pipeline-output` 中输出（结构化且量小，无 Token 截断风险）

### 10.1 总体原则

所有 Agent Stage 均通过统一三层策略产出结构化结果：

1. **代码层声明 schema**
2. **Prompt 自动注入输出要求**
3. **运行时解析 + Zod 校验 + 修正重试**

#### 10.1.1 Stage 对应 schema

- `breakdown` → `PRD`
- `spec` → `TaskACSpec[]`
- `estimate` → `PlanReport`

### 10.2 Canonical fenced block 规范

assistant 必须返回唯一的 fenced block：

````markdown
```json:pipeline-output
{
  ...
}
```
````

本期严格要求：

- 必须且只能有一个 `json:pipeline-output`
- 结构化结果必须是完整合法 JSON
- 解释文字可有，但不得替代该 block

### 10.3 解析流程

`StructuredOutputParser` 分三步执行：

#### 第一步：提取 fenced block

```typescript
extractCanonicalFencedBlock(text): string | null
```

#### 第二步：JSON 反序列化

```typescript
safeParseJson(raw): unknown
```

#### 第三步：Schema 校验

```typescript
zodSchema.safeParse(parsed)
```

### 10.4 标准错误码

解析失败统一返回以下错误码之一：

```typescript
type StageFailureCode =
  | 'SESSION_CREATE_FAILED'
  | 'SESSION_TIMEOUT'
  | 'SESSION_RUNTIME_ERROR'
  | 'NO_OUTPUT_BLOCK'
  | 'MULTIPLE_OUTPUT_BLOCKS'
  | 'INVALID_JSON'
  | 'SCHEMA_VALIDATION_FAILED'
  | 'EVALUATION_REJECTED'
  | 'PIPELINE_CANCELLED';
```

---

## 11. 格式修正策略

### 11.1 修正发生在同一 Attempt 内

当 Agent 输出已完成，但格式不符合要求时，不立即新建 attempt，而是：

1. 保持使用原 Session
2. 将 attempt 状态置为 `WAITING_REPAIR`
3. 向同一 Session 发送修正消息
4. 修正后继续轮询
5. 成功则 attempt 恢复为 `RUNNING` 再进入 `SUCCEEDED`

### 11.2 修正次数上限

每个 attempt 默认允许 **最多 2 次** 格式修正：

- 未超过上限：继续修正
- 超过上限：该 attempt 标记 `FAILED`
- 是否再开新 attempt，由 Stage retry policy 决定

### 11.3 修正消息模板

```text
你上一条回复未满足系统要求，请只修正结构化输出部分，不要重复解释文字。

错误类型：
- INVALID_JSON / SCHEMA_VALIDATION_FAILED / MULTIPLE_OUTPUT_BLOCKS / NO_OUTPUT_BLOCK

请严格返回唯一一个：
```json:pipeline-output
...
```
```

---

## 12. Prompt 与上下文裁剪

### 12.1 Prompt Builder 统一入口

保留统一 prompt 组装方式：

- `prompt-builder.ts`
- `breakdown.prompt.ts`
- `spec.prompt.ts`
- `estimate.prompt.ts`

输出结构建议为：

```typescript
type BuiltStagePrompt = {
  systemPrompt: string;
  userPrompt: string;
  inputSnapshot: unknown;
  schemaName: string;
};
```

其中 `inputSnapshot` 必须写入 `StageExecutionAttempt.inputSnapshot` 以便审计与 human review 展示。

**inputSnapshot 写入时机与上下文层级追踪：**

- `inputSnapshot` 在 prompt 最终确定、发送给 Agent **之前**写入，记录实际送出的上下文内容
- 若运行中上下文从 L1 升级为 L2，**覆盖更新** `inputSnapshot`（旧 L1 快照不保留）
  - 原因：`inputSnapshot` 的语义是"本次 attempt 实际使用的输入"，而非历史变更记录
  - 若需追踪上下文升级历史，可在 `inputSnapshot` 内增加 `contextLevel: 'L1' | 'L2' | 'L3'` 字段标记
- L3（人工编辑上下文）进入 human_review 后由审批人修改，修改后的内容在 retry 时写入新 attempt 的 `inputSnapshot`，不修改原 attempt 记录

### 12.2 上下文裁剪采用三层策略

原设计中“传摘要而不是全量”方向正确，但过于静态。本期改为三层策略：

#### L1：最小上下文

默认使用，尽量节省 token。

例如：

- `breakdown`：需求原文 + 必要项目上下文
- `spec`：PRD 摘要 + task 列表摘要
- `estimate`：PRD 摘要 + AC Spec 全量

#### L2：增强上下文

当以下情况出现时，自动提升到增强上下文：

- evaluation reject
- parse 多次修正仍失败
- 上一 attempt 质量明显不达标

#### L3：人工编辑上下文

进入 `human_review` 后，允许人工在重试前修改输入上下文。

### 12.3 裁剪策略目标

上下文裁剪的目标不是单纯省 token，而是在“足够完成当前任务”和“避免无意义上下文膨胀”之间取得平衡。若未来发现某 Stage 在最小上下文下准确率不足，应优先升级上下文层级，而不是在 prompt 中无限堆约束。

---

## 13. Worker 状态推进设计

### 13.1 推进原则

`PipelineWorkerService` 只依据 `Pipeline.state.currentStageKey` 推进流程：

1. 读取 Pipeline 与 `Pipeline.state`
2. 根据 `currentStageKey` 找到对应 `PipelineStage`
3. 根据 stageType 选择执行器
4. Agent Stage 调用 `PipelineSessionBridgeService`
5. 将结果原子写回 `Pipeline.state`
6. 推进到下一逻辑阶段

### 13.2 原子提交要求（含乐观锁防脑裂）

一个 Stage 成功时，以下动作必须在同一事务内完成：

- 将 attempt 标记为 `SUCCEEDED`
- 将结构化产物写入 `Pipeline.state.artifacts`
- 将 `currentStageKey` 推进到下一 Stage
- **使用乐观锁写回 Pipeline.state**：

```sql
UPDATE Pipeline
SET state = <newState>, version = version + 1
WHERE id = <pipelineId> AND version = <expectedVersion>
```

**并发打断机制**：若受影响行数为 `0`，说明 Worker 在大模型生成周期内外部已发生状态变更（用户 Cancel、人工协同修改等），当前 Worker 持有的是脏快照。此时必须**抛弃写回并直接退出本轮循环**，不得重试写入。

例如 `breakdown` 成功时，应在一个事务内完成：

- `artifacts.prd = parsedPrd`（长文本时：`artifacts.prdRef = { filePath, summary }`）
- `currentStageKey = evaluation`
- `UPDATE Pipeline SET state=..., version=version+1 WHERE id=? AND version=<expected>`
- 当前 attempt `SUCCEEDED`

这可避免"产物已写入但 stage 未推进"或"旧 Worker 覆盖新状态"的一致性问题。

### 13.3 Gate Stage 与 Human Stage

- `evaluation`：纯逻辑 stage，不创建 attempt
- `human_review`：人工节点，不创建 Agent Session，但需要生成 review payload
- `complete`：终态，不再推进

---

## 14. Attempt 生命周期与幂等恢复

### 14.1 Attempt 状态机

```text
PENDING
  -> RUNNING
  -> WAITING_REPAIR
  -> RUNNING
  -> SUCCEEDED
  -> FAILED
  -> CANCELLED
  -> ABANDONED
```

说明：

- `PENDING`：attempt 已创建但尚未真正开始执行
- `RUNNING`：Session 创建完成并已发送消息，处于执行中
- `WAITING_REPAIR`：输出格式有问题，准备修正
- `SUCCEEDED`：结构化结果校验通过并已写入 Pipeline.state
- `FAILED`：本次 attempt 失败，但 Stage 可继续 retry
- `CANCELLED`：用户取消 Pipeline 时主动终止
- `ABANDONED`：旧 Worker 遗留 attempt 被判定为过期废弃（leaseExpiresAt 已过期）
- `RESOLVED_BY_HUMAN`：人工 edit_and_continue 成功后的终态；SFT 语料筛选时此状态的 attempt 的 `outputSnapshot` 视为不可信样本，应被过滤

### 14.2 恢复场景

#### 场景 A：attempt 已创建，Session 尚未创建，Worker 崩溃

恢复时：

- 发现 attempt `PENDING`
- `sessionId = null`
- 复用该 attempt 继续创建 Session

#### 场景 B：Session 已创建，attempt 已绑定，Worker 崩溃

恢复时：

- 发现 attempt `RUNNING`
- `sessionId != null`
- 尝试继续轮询该 Session
- 如 Session 已完成，则继续解析
- 如 Session 不可恢复，则 attempt `FAILED`

#### 场景 C：lease 转移，旧 Worker 仍在执行

恢复时：

- 新 Worker 发现已有活跃 attempt
- 判断其是否 stale
- stale 则将旧 attempt 标为 `ABANDONED`
- 再创建新 attempt

### 14.3 Stale 判定与心跳续约（防死锁机制）

**Worker claim attempt 时使用带 TTL 的乐观锁：**

```sql
UPDATE StageExecutionAttempt
SET ownerLeaseToken = <myWorkerId>,
    leaseExpiresAt  = NOW() + INTERVAL '2 MINUTE',
    updatedAt       = NOW()
WHERE id = <attemptId>
  AND (ownerLeaseToken IS NULL
       OR ownerLeaseToken = <myOldToken>
       OR leaseExpiresAt < NOW())   -- 核心解锁条件：租约已超时
```

- 写入成功（rowCount = 1）：当前 Worker 持有锁，开始执行
- 写入失败（rowCount = 0）：另一 Worker 持有有效锁，当前 Worker 跳过

**心跳续约：**

Worker 持有 attempt 期间，必须启动后台定时器（建议每 60s），执行：

```sql
UPDATE StageExecutionAttempt
SET leaseExpiresAt = NOW() + INTERVAL '2 MINUTE'
WHERE id = <attemptId> AND ownerLeaseToken = <myWorkerId>
```

若 Worker OOM / 宕机 / 停电，心跳停止，`leaseExpiresAt` 自然过期，集群中其他闲置 Worker 在下次扫描时可通过 `leaseExpiresAt < NOW()` 条件无缝接管。

**废弃旧 fallback 方案**：v3.1 的 `updatedAt + timeout` 简化方案因有双重 ABANDONED 竞争风险，已由此方案替代，不再保留。
---

## 15. 超时与取消传播

### 15.1 分层超时

继续保留原设计的分层超时思想，但与 attempt 生命周期结合：

- Pipeline 级超时：默认 30 分钟
- Stage 级超时：默认 10 分钟
- Session poll 超时：默认 10 分钟
- Parse repair 总时长纳入 Stage 级超时

### 15.2 Session 超时处理

当 Session 执行超时：

1. 调用 Session cancel
2. 当前 attempt 标记 `FAILED`
3. 记录错误码 `SESSION_TIMEOUT`
4. 若该 Stage 尚有 retry budget，则创建新 attempt
5. 否则进入 `human_review`

### 15.3 Pipeline cancel 传播

当 `Pipeline.status = CANCELLED`：

1. Worker 在循环头或轮询过程中检测到取消
2. 查找当前活跃 attempt
3. 如存在 `sessionId`，调用 session cancel
4. 将 attempt 标记 `CANCELLED`
5. Worker 正常退出

---

## 16. Stage 失败策略

### 16.1 breakdown

`breakdown` 的特殊点在于它后面有 `evaluation` gate。

**Attempt 语义与 retryBudget 计数规则：**

- breakdown 的 `retryBudget` 区分两种消耗来源，两者共享同一上限（默认 3），分别计数：
  - `agentFailureCount`：Session 运行失败 / 超时 / 解析失败时 +1，**创建新 attempt**
  - `evaluationRejectCount`：evaluation gate reject 时 +1，**同样创建新 attempt**
- 两种情形均新建 attempt 的理由：每次重新调用 Agent 都是独立的一次执行，应有独立的审计记录；复用旧 attempt 会导致 `inputSnapshot` / `outputSnapshot` 被覆盖，丢失失败信息
- `remaining = maxBudget - agentFailureCount - evaluationRejectCount`
- evaluation reject 后重试时，Worker 进入 breakdown 阶段后通过 DB 查询动态推导新建下一个 attempt，此时 `breakdownRejectionHistory` 已 push 新条目至 `Pipeline.state.feedback`，新 attempt 的 prompt 构建时会读取全量历史作为 L2 增强上下文

处理规则：

- `breakdown` 成功产出 PRD 后先进入 `evaluation`
- 若 evaluation reject：
  - `breakdownRejectionHistory.push(evaluationRejectReason)`（全量追加，不覆盖）
  - `evaluationRejectCount + 1`
  - 若 `remaining > 0`，则 `currentStageKey = breakdown`（Worker 下次循环时新建 attempt）
  - 否则进入 `human_review`（reason: `EVALUATION_REJECTED`）
- evaluation reject 不视为 Session 运行错误，但消耗 retry budget，且必须创建新 attempt 保证审计完整性

### 16.2 spec

处理规则：

- Session 错误 / timeout / parse fail 都先记为 attempt 失败
- 若 `spec` 尚有 retry budget，则创建新 attempt
- 超过预算则进入 `human_review`

### 16.3 estimate

与 `spec` 类似，但在人工节点允许更多“skip/terminate”场景，因为某些情况下估算失败不一定阻塞全部后续流程。

---

## 17. human_review 设计

### 17.1 进入 human_review 的原因

```typescript
type HumanReviewReason =
  | 'AGENT_TIMEOUT'
  | 'AGENT_RUNTIME_ERROR'
  | 'PARSE_FAILED'
  | 'MANUAL_ESCALATION'
  | 'EVALUATION_REJECTED';
```

### 17.2 human_review 输入结构

进入 `human_review` 前，系统通过 `HumanReviewAssembler` 组装如下信息：

- 来源 stageKey
- 来源 attemptId
- 最近一次失败原因与错误码
- 历史 attempts 概览
- 最近一次 Session 链接
- 最近一次 candidate output
- 当前 artifacts 概览
- 推荐动作集合

### 17.3 human_review 支持动作

#### retry

- 基于当前 stage 再开下一次 attempt
- 可保留原上下文，也可配合人工编辑上下文（L3 层级）
- **【预算重置】**：由人工从 `human_review` 触发的 retry，系统必须强制重置目标 Stage 的失败计数器（`agentFailureCount` / `evaluationRejectCount` 清零，`remaining` 恢复至最大值）。避免 budget 耗尽的 stage 在 prompt 被优化后，因"余额为零"导致任何格式小错再次弹回人审，形成死锁循环

#### edit_and_continue

- 人工直接编辑结构化产物
- 系统对人工输入再次做 schema 校验（与 `StructuredOutputParser` 使用同一 Zod schema）
- **校验通过**：
  - 将人工产物写入 `Pipeline.state.artifacts`，推进到下一 Stage
  - **【审计闭环】**：将卡住的源 attempt 状态标记为 `RESOLVED_BY_HUMAN`（而非 SUCCEEDED），确保后续 SFT 语料筛选时能准确过滤含人工修改的样本，保证训练数据纯净度
- **校验失败**：
  - 返回具体校验错误信息给前端，`HumanReviewPanel` 展示错误详情并保持编辑态
  - 不推进 Stage，不修改 `Pipeline.state`
  - 审批人可再次修改后提交，或改选其他动作（retry / skip / terminate）
  - 后端不自动进入新一轮 human_review 循环，由前端保持当前 review 状态

#### skip

- 跳过当前 Stage，推进到下一个 Stage
- 需记录 reviewer comment
- 仅对允许跳过的 stage 开放

#### terminate

- 将 Pipeline 标记为终止
- 不再继续推进

### 17.4 推荐动作矩阵

| 来源 Stage | 进入原因 | 推荐动作 |
|---|---|---|
| `breakdown` | `AGENT_TIMEOUT` / `AGENT_RUNTIME_ERROR` / `PARSE_FAILED` | `retry`、`edit_and_continue`、`terminate` |
| `breakdown` | `EVALUATION_REJECTED` | `retry`（含编辑上下文）、`edit_and_continue`、`terminate` |
| `spec` | `AGENT_TIMEOUT` / `AGENT_RUNTIME_ERROR` / `PARSE_FAILED` | `retry`、`edit_and_continue`、`terminate` |
| `estimate` | `AGENT_TIMEOUT` / `AGENT_RUNTIME_ERROR` / `PARSE_FAILED` | `retry`、`edit_and_continue`、`skip`、`terminate` |
| 任意 | `MANUAL_ESCALATION` | `retry`、`edit_and_continue`、`skip`（仅 estimate）、`terminate` |

**`MANUAL_ESCALATION` 处理规则：**

- 来源 stageKey 由触发时的 `Pipeline.state.currentStageKey` 确定
- 若触发时正处于 Agent Stage（breakdown / spec / estimate），则 `sourceStageKey` = 当前 stage
- 若触发时处于 `evaluation`，则 `sourceStageKey = breakdown`（视为 breakdown 阶段的人工上报）
- `suggestedActions` 根据 `sourceStageKey` 按上表选取，不单独为 MANUAL_ESCALATION 设计特殊动作集合
- `summary` 由触发方提供，`candidateOutput` 可为 null

---

## 18. doc workspace 策略

### 18.1 默认挂载 doc workspace

Plan Pipeline 的 Agent Stage 默认包含：

```typescript
workspaceResources: ['doc']
```

即允许在 doc workspace 中产出 PRD、AC Spec、估算报告等中间文档。

### 18.2 本期对 doc 的边界

为了避免本期扩大为完整 Git 工作流改造，本期仅定义：

1. Agent 可读写 doc workspace
2. 不要求自动 commit / push
3. UI 可查看 Session 产生的文档副作用
4. Pipeline 状态推进只依据 canonical JSON output，不依据 doc 文件内容

这样能先实现“Agent 真正会写文档”，同时不把 Git 并发与分支冲突问题引入本期主路径。

### 18.3 后续可扩展方向

后续可追加：

- doc branch 隔离
- Session 结束后自动 commit
- diff 展示
- human review 直接基于文档 diff 审批

---

## 19. Schema 变更

### 19.0 保留不变的模型

以下模型不新增反向依赖：

- `AgentRunner`
- `Profile`
- `Project`
- `AgentSession`
- `SessionMessage`

### 19.1 Pipeline（新增乐观锁）

```prisma
model Pipeline {
  // ... 现有字段（id, projectId, state, status 等保持不变）...
  version  Int  @default(0)  // 全局乐观并发锁，每次原子写回时 +1，详见 §13.2
}
```

### 19.2 PipelineStage

```prisma
model PipelineStage {
  id           String   @id @default(cuid())
  pipelineId   String
  stageKey     String
  stageType    String
  orderIndex   Int
  agentConfig  Json?

  // 关联关系：Pipeline 删除时级联删除 Stage 及其所有 Attempt
  pipeline     Pipeline @relation(fields: [pipelineId], references: [id], onDelete: Cascade)
  attempts     StageExecutionAttempt[]

  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
```

### 19.3 StageExecutionAttempt

```prisma
model StageExecutionAttempt {
  id                  String    @id @default(cuid())
  stageId             String

  attemptNo           Int
  // PENDING | RUNNING | WAITING_REPAIR | SUCCEEDED | FAILED | CANCELLED | ABANDONED | RESOLVED_BY_HUMAN
  status              String

  sessionId           String?
  // 当前正在等待结果的用户消息 id，随每次修正消息原子更新（详见第 9.3 节）
  activeRequestMessageId String?

  // 分布式宕机防死锁：Worker claim 时写入 token + 设置过期时间
  // 持有期间心跳续约（每 60s）；OOM/宕机后到期自动释放，供他人接管
  ownerLeaseToken     String?
  leaseExpiresAt      DateTime?

  resolvedAgentConfig Json?
  inputSnapshot       Json?
  outputSnapshot      Json?
  errorCode           String?
  errorMessage        String?

  parseRepairCount    Int       @default(0)
  startedAt           DateTime?
  finishedAt          DateTime?

  // 关联关系：Stage 删除时级联删除所有 Attempt
  stage        PipelineStage @relation(fields: [stageId], references: [id], onDelete: Cascade)

  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt

  // correlationKey 已移除：@@unique 复合约束 + DB 动态推导 attempt 已足以防止重复创建
  @@unique([stageId, attemptNo])
}
```

---

## 20. 新增服务与模块职责

### 20.1 `PipelineAgentConfigResolver`

职责：

- 解析 Stage 原始 agentConfig
- 合并系统默认值
- 校验 runner / skill / rule / mcp
- 生成 `ResolvedPipelineAgentConfig`

### 20.2 `PipelineSessionBridgeService`

职责：

- 协调 attempt 生命周期
- Session 创建 / 恢复 / 取消
- prompt 发送
- 消息轮询
- structured output 修正与解析

### 20.3 `StructuredOutputParser`

职责：

- 提取 fenced block
- JSON 反序列化
- schema 校验
- 输出标准错误码

### 20.4 `StageContextBuilder`

职责：

- 为不同 stage 构建最小 / 增强上下文
- 输出 `inputSnapshot`

### 20.5 `HumanReviewAssembler`

职责：

- 将失败信息组装为可供前端直接展示的 human review payload

---

## 21. 前端展示要求

### 21.1 PipelineStageTimeline

前端时间线应展示：

- 每个 Stage 的静态定义
- 每个 Stage 的 attempts 数量
- 每个 attempt 的状态
- 对应 Session 链接
- 最近一次失败原因

### 21.2 HumanReviewPanel

应展示：

- 来源 stage
- 失败摘要
- 候选输出
- 历史 attempts
- reviewer comment 输入框
- 可执行动作按钮

### 21.3 产物展示

对 `breakdown/spec/estimate` 的 canonical output，前端应优先展示结构化结果，而不是只展示原始 assistant 文本。

---

## 22. 详细执行流程

### 22.1 breakdown

```text
currentStageKey = breakdown
  -> resolve agent config
  -> create or recover attempt
  -> create or recover session
  -> build prompt + inputSnapshot
  -> send prompt
  -> poll session result
  -> parse canonical fenced JSON
  -> parse fail? repair in same session
  -> success? write PRD into Pipeline.state.artifacts.prd
  -> currentStageKey = evaluation
```

### 22.2 evaluation

```text
currentStageKey = evaluation
  -> evaluate prd
  -> pass: currentStageKey = spec
  -> reject:
       breakdownRejectionHistory.push(reason)  // 全量追加，不覆盖
       if breakdown retry budget remains:
          currentStageKey = breakdown
       else:
          assemble human review
          currentStageKey = human_review
```

### 22.3 spec

```text
currentStageKey = spec
  -> resolve config
  -> create/recover attempt
  -> execute session
  -> parse TaskACSpec[]
  -> success: write artifacts.acSpec
  -> currentStageKey = estimate
  -> fail with retry budget: create next attempt
  -> fail without budget: human_review
```

### 22.4 estimate

```text
currentStageKey = estimate
  -> resolve config
  -> create/recover attempt
  -> execute session
  -> parse PlanReport
  -> success: write artifacts.planReport
  -> currentStageKey = human_review or complete
```

> 若当前产品流程中 `human_review` 是所有 plan 最终都必须经过的人工节点，则 estimate 成功后进入 `human_review`。  
> 若未来改为“仅失败时进入人工节点”，则 estimate 成功后可直接 `complete`。

### 22.5 human_review

```text
currentStageKey = human_review
  -> wait reviewer action
  -> retry: back to source stage
  -> edit_and_continue: validate manual output and move next
  -> skip: move next
  -> terminate: stop pipeline
```

---

## 23. 文件清单

### 23.1 packages/shared

```text
src/types/pipeline-agent-config.ts
src/types/pipeline-runtime-state.ts
src/types/stage-execution-attempt.ts
src/schemas/pipeline-agent-config.schema.ts
src/schemas/plan-report.schema.ts
```

### 23.2 backend / pipelines

```text
pipeline-agent-config-resolver.service.ts
pipeline-session-bridge.service.ts
human-review-assembler.service.ts

stage-output-schemas/
  breakdown.output-schema.ts
  spec.output-schema.ts
  estimate.output-schema.ts

stage-prompts/
  prompt-builder.ts
  breakdown.prompt.ts
  spec.prompt.ts
  estimate.prompt.ts

output-parsers/
  structured-output.parser.ts
  stage-context.builder.ts
```

### 23.3 修改文件

```text
pipelines.module.ts
pipeline-worker.service.ts
pipeline-stage.repository.ts
frontend/.../PipelineStageTimeline
frontend/.../HumanReviewPanel
```

---

## 24. 测试策略

### 24.1 单元测试

必须覆盖：

- agentConfig 默认值补齐
- agentConfig 非法 ID 校验
- structured output 提取
- invalid json / multiple blocks / schema fail
- retry budget 消耗逻辑
- human review payload 组装
- manual `edit_and_continue` 的 schema 校验

### 24.2 集成测试

必须覆盖：

- attempt 创建成功但 Session 未创建时的恢复
- Session 创建成功但 Worker 崩溃时的恢复
- RUNNING attempt 重新 claim 的 stale 处理
- cancel 时 Session cancel 被调用
- 同一 attempt 连续 2 次 parse repair
- 超时后 fallback human_review

### 24.3 端到端测试

至少覆盖以下路径：

1. mock runner 一次成功
2. mock runner 首次坏 JSON，修正后成功
3. mock runner 连续坏 JSON，进入 human_review
4. mock runner timeout，进入 human_review
5. reviewer 选择 `edit_and_continue`
6. reviewer 选择 `retry`
7. reviewer 选择 `skip`
8. reviewer 选择 `terminate`

---

## 25. 实施顺序

```text
Step 1   shared: 定义统一 runtime state、PlanReport、Attempt 类型
Step 2   prisma: 新增 StageExecutionAttempt
Step 3   backend: 实现 PipelineAgentConfigResolver
Step 4   backend: 实现 output schema 与 StructuredOutputParser
Step 5   backend: 实现 StageContextBuilder 与 prompt builder
Step 6   backend: 实现 PipelineSessionBridgeService
Step 7   backend: 改造 PipelineWorkerService，仅按 Pipeline.state 推进
Step 8   backend: 实现 human_review payload 与 reviewer action handling
Step 9   frontend: 展示 attempts、session 链接、human review panel
Step 10  测试：unit + integration + mock e2e
Step 11  真实 runner 灰度验证
```

---

## 26. 风险与权衡

### 26.1 为什么不直接把运行态也拆成独立表

可以，但本期会显著放大改造面。当前继续使用 `Pipeline.state` 能以较低成本收敛运行时事实来源。新增 `StageExecutionAttempt` 已足以解决审计与恢复问题。

### 26.2 为什么 canonical output 不直接用 doc 文件

因为 doc 文件会引入：

- 文件写入时序问题
- 多文件命名问题
- Git 状态问题
- Session 与文件副作用不一致问题

本期先用消息中的结构化 JSON 作为状态推进依据，更稳定、更易回放。

### 26.3 为什么 parse repair 放在同一 attempt 内

格式错误通常不是业务失败，而是输出协议失败。在同一 attempt / 同一 Session 中修正，更符合人类使用体验，也能减少额外 Session 成本。

### 26.4 为什么 human_review 要支持 edit_and_continue

否则人工节点只剩“再试一次”，不具备恢复价值，也无法应对“Agent 差一点点，但人一改就能继续”的高频场景。

---

## 27. 最终结论

本期最终推荐方案如下：

1. 保留 Stage 级 `agentConfig` 值对象设计
2. **新增 `StageExecutionAttempt`**，包含 `activeRequestMessageId`（轮询定位）、`ownerLeaseToken` + `leaseExpiresAt`（心跳租约防死锁）、`RESOLVED_BY_HUMAN` 状态枚举（审计闭环）；删除冗余 `correlationKey`
3. **`Pipeline.state` 为宏观事实来源**，`currentStageKey` 是唯一阶段定位字段；`currentAttemptNo` 已移除，Worker 通过 DB 动态推导当前 attempt，实现零歧义 SSOT
4. **全局乐观锁**：`Pipeline.version` + `UPDATE WHERE version=expected`，version mismatch 时 Worker 安全退出，彻底防止 Lost Update 幽灵覆盖
5. **心跳租约防死锁**：`leaseExpiresAt` TTL + 每 60s 心跳续约，Worker OOM/宕机后 1~2 分钟自动释放，备用节点无缝接管
6. **产物指针模式防 Token 熔断**：PRD/Spec 等长文本由 Agent 写入 doc workspace，`json:pipeline-output` 只返回文件路径与摘要；PlanReport 仍全量输出
7. **`breakdownRejectionHistory` 数组**防大模型遗忘：全量保留历次 evaluation reject 原因，新 attempt 的 prompt 全量读取作为 L2 增强上下文
8. **WAITING_REPAIR 崩溃恢复防幻觉**：先拉取 Session 最新消息比对，确认未发送才下发修正指令，禁止盲目重发
9. **`human_review` 双闭环**：`edit_and_continue` 成功后原 attempt 标记 `RESOLVED_BY_HUMAN` 保证 SFT 语料纯净；`retry` 时强制重置 retry budget 释放完整重试空间
10. breakdown 的 `retryBudget` 区分 `agentFailureCount` / `evaluationRejectCount` 双计数器；evaluation reject 统一新建 attempt 保证审计完整
11. Schema 补充外键关联与 Cascade；`PlanReport` 类型完整定义；doc workspace 默认挂载但不作为状态推进依据

该方案在不推翻现有架构的前提下，将 Plan Pipeline 从 mock 方案平滑升级为在物理集群高并发与真实大模型约束下可运行、可恢复、可审计、可人工接管的半自动优化循环。
