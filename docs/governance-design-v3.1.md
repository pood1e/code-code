# 通用问题发现与变更治理系统设计方案

> 状态：草案  
> 版本：v3.1（终稿修订：集成验证 Schema 对齐 / 告警精细化 / 靶向 Diff 防死刑 / DAG 依赖 / 微操通道 / Spin-off 技术债）  
> 目标：在不将系统写死为"架构缺陷修复流水线"的前提下，定义一套可扩展的通用问题发现、归一化、评估、变更执行、验证与交付框架。

---

## 变更记录（v1 → v2）

| 优先级 | 章节 | 修订内容 |
|---|---|---|
| 🔴 | §4.1 Finding | 新增 `status` 字段与生命周期定义 |
| 🔴 | §4.1 + §4.2 | 新增 §4.1.1 FindingMergeRecord，定义归并协议（触发条件 / 聚类维度 / Finding 状态标记） |
| 🔴 | §4.6 ChangeUnit | 新增 `sourceActionId` 字段，与 `ChangePlan.proposedActions` 中的 `ChangeAction.id` 建立派生关系 |
| 🔴 | §4.7 VerificationPlan | 明确 1:1 归属关系（每个 ChangeUnit 拥有独立 VerificationPlan），移除双向引用 |
| 🔴 | §4.2 + §4.6 | 新增 §4.2.1 Issue 状态机、§4.6.1 ChangeUnit 状态机，定义转换规则与触发条件 |
| 🟠 | §4.3 IssueAssessment | 明确四维评分量纲（0–10 整数）与加权公式，补充与 AutoActionPolicy 的优先级规则 |
| 🟠 | §4.4 ResolutionDecision | `defer` 新增 `deferUntil` 可选字段 |
| 🟠 | §4.9 ReviewDecision | `subjectType` 新增 `finding`（误报撤销）和 `assessment`（评估结论覆盖） |
| 🟠 | §4.1 Finding | `confidence` 明确量纲为 0.0–1.0 浮点数，定义过滤阈值语义 |
| 🟠 | §8 Pipeline | 新增 §8.0 Pipeline 间数据流协议；Pipeline B/C/D 输入中补充 `RepositoryProfile` 引用 |
| 🟡 | §4.6 ChangeUnit | `scope` 新增 `violationPolicy` 字段 |
| 🟡 | §4.10 DeliveryArtifact | 新增 `bodyStrategy` 字段定义聚合规则 |
| 🟡 | §8.1 Pipeline A | 新增 `RepositoryProfile` 类型定义 |
| 🟡 | §4.8 VerificationResult | 明确 1:1 归属，`changeUnitId` 从可选改为必填 |

> **v2 → v3 追加修订（基于深水区并发 + LLM 行为沙盘推演）**

| 优先级 | 章节 | 修订内容 |
|---|---|---|
| P0 防熔断 | §4.6 + §4.6.1 | `ChangeUnit` 新增 `maxRetries` / `currentAttemptNo` 执行预算；状态机新增 `exhausted` 终态，重试耗尽强制截断并呼叫人工 |
| P0 防扫描风暴 | §4.2 + §4.2.1 | `Issue` 新增 `deferred` 休眠态，`defer` 时跃迁至 `deferred` 移出活跃轮询视图，Cron Job 到期唤醒 |
| P0 审计防丢 | §4.8 VerificationResult | `VerificationResult` 改为 1:N 追加记录；新增 `executionAttemptNo` 字段，完整保留每次重试的验证快照 |
| P1 防基线漂移 | §4.5 ChangePlan | 新增 `baselineCommitSha` 字段；Pipeline E 执行第一步必须校验 HEAD，漂移严重时拦截并触发重新规划 |
| P1 打分器重构 | §4.3 + §5.2 | `fixCost` 从优先级加权公式移除；`priority` 仅由 `userImpact + systemRisk + strategicValue` 决定；`fixCost` 仅影响 `autoActionEligibility` 判断 |
| P1 集成验证拓扑 | §4.7 VerificationPlan | 新增 `subjectType: 'change_unit' \| 'change_plan'`；CU 级跑局部轻量验证，Plan 级聚合跑集成 E2E |
| P2 部分成功流转 | §4.2.1 Issue 状态机 | `in_review` 推进条件改为"所有**活跃（非 cancelled）** ChangeUnit verified"；新增 `partially_resolved` 状态 |
| P2 防回归静默 | §4.1.1 FindingMergeRecord | 归并目标 Issue 为 `closed`/`wont_fix` 时，强制 reopen 或新建带 `isRegression: true` 的新 Issue，阻止回归警报被静默吞噬 |
| P2 防并发踩踏 | §8.0 Pipeline 数据流 | Pipeline 任务消费引入 `ownerLeaseToken` 租约锁 + `version` 乐观锁，防止多 Worker 重复处理同一 Finding/Issue |

> **v3 → v3.1 终稿修订（极端业务场景沙盘推演）**

| 优先级 | 章节 | 修订内容 |
|---|---|---|
| P0 Schema 对齐 | §4.8 VerificationResult | 新增 `subjectType`；`changeUnitId` 改为可选（CU 级必填）；新增 `changePlanId`（Plan 级必填），消除 Plan 级验证结果无法落库的 Schema 冲突 |
| P0 状态黑洞 | §4.2 + §4.2.1 | Issue 新增 `integration_failed` 状态；`in_review` 推进条件精确为"活跃 CU 全 verified **且** Plan 级验证通过"；补充 `integration_failed` 的出口转换 |
| P1 防告警风暴 | §4.1.1 FindingMergeRecord | 终态拦截精确区分：`closed` 触发 reopen/新建；`wont_fix` / `accepted_risk` / `deferred` 执行**静默归并**，新 Finding 继承 `dismissed`，不唤醒 Issue |
| P1 靶向 Diff | §4.5 ChangePlan | `baselineCommitSha` 校验从"全局 SHA 对比"降级为"靶向文件 Diff"（`git diff baselineCommitSha HEAD -- <affectedTargets>`），只有目标文件被修改才拦截，无关变更不阻断 |
| P2 DAG 依赖 | §4.6 ChangeUnit | 新增 `dependsOnUnitIds: string[]`，支撑有向无环图（DAG）执行调度，使状态机的"前置完成"条件有物理依据 |
| P2 微操通道 | §4.6.1 ChangeUnit 状态机 | `exhausted` 新增 `edit_and_continue` 出口，允许人工直接修正 AI 最后一里路（如补一行 import）直接推进至 `verified`，而无需重置预算重跑 |
| P2 Spin-off | §4.2.1 Issue 状态机 | `partially_resolved → closed` 时，系统自动将 `cancelled`/`exhausted` ChangeUnit 剥离，Spin-off 派生为新 `open` Issue，防止未完成技术债从 backlog 蒸发 |

---

## 1. 文档目的

本文档定义一套面向软件工程场景的**通用问题发现与变更治理系统**。该系统不局限于"架构缺陷修复"，而是支持将多来源发现信号统一沉淀为可治理的问题对象，并进一步生成处理方案、执行变更、完成验证与交付。

系统目标包括：

1. 从多种来源发现问题，而不依赖单一 Agent 或单一工具。
2. 将原始发现统一归一化为可管理、可排序、可跟踪的问题项。
3. 支持生成处理方案、拆分执行单元，并对执行过程进行验证。
4. 支持人工审批、风险接受、延期处理，而不是强制"全部自动修复"。
5. 支持 PR / MR / 报告等多种交付方式。
6. 保持领域抽象通用，避免模型被"架构设计 / Clean Code / 测试覆盖 / UX"这些当前分类写死。

---

## 2. 设计原则

### 2.1 核心模型描述"对象是什么"

核心模型仅描述领域对象本身，这些模型不直接绑定具体分类和策略。

### 2.2 分类、优先级、验证方式都通过策略配置表达

- `architecture / testing / ux / security` 属于 taxonomy，不写死在核心模型里
- `P0 / P1 / P2 / P3` 属于优先级策略结果，不是问题对象的固有属性
- `lint / unit / e2e / a11y / static_scan` 属于验证策略，不是唯一合法验证方式

### 2.3 "修复"只是处置方式的一种

处置方式还包括 `refactor / mitigate / accept_risk / defer / duplicate / wont_fix / needs_human_decision`，因此系统应围绕"问题治理"而非"缺陷修复"来建模。

### 2.4 执行层与决策层分离

系统显式区分：发现层 → 归一化与评估层 → 变更计划层 → 执行层 → 验证与交付层。

### 2.5 模型引用关系遵循单向原则

核心对象之间的引用尽量单向，避免双向引用导致权威来源歧义。引用方向遵循：Finding → Issue → ChangePlan → ChangeUnit → VerificationPlan → VerificationResult → DeliveryArtifact。

---

## 3. 系统适用范围

该系统可实例化到以下场景：架构设计缺陷治理、Clean Code 问题治理、测试缺口补全、UX / 可访问性问题改进、安全问题修复、依赖治理与升级、可观测性增强、发布前质量检查。

核心不在于问题类型，而在于：

> 从发现信号中形成正式问题项，并将问题项通过方案、执行、验证和交付链路闭环。

---

## 4. 通用核心模型

### 4.1 Finding

Finding 表示原始发现项，尚未被归一化为正式问题。

```ts
type Finding = {
  id: string
  source:
    | 'agent_review'
    | 'static_analysis'
    | 'test_run'
    | 'coverage_check'
    | 'ux_review'
    | 'a11y_check'
    | 'human_feedback'
    | 'runtime_signal'
    | 'dependency_scan'
    | 'custom'
  sourceRef?: string

  title: string
  summary: string
  evidence: EvidenceRef[]

  categories: string[]   // 原始分类暗示，使用 CategoryTaxonomy 中的 key
  tags: string[]

  severityHint?: 'critical' | 'high' | 'medium' | 'low'

  /**
   * 发现置信度，取值范围 0.0–1.0（浮点数）。
   * 建议过滤阈值：< 0.3 视为噪音，归一化时仅作参考；
   * 0.3–0.7 正常处理；>= 0.7 高置信，可直接进入 Issue 归一化。
   * 若未提供，默认按 1.0 处理（如人工反馈来源）。
   */
  confidence?: number

  affectedTargets: TargetRef[]
  metadata?: Record<string, unknown>

  /**
   * Finding 生命周期状态。
   * - pending：尚未处理
   * - merged：已归并到 Issue（见 FindingMergeRecord）
   * - dismissed：已标记为误报或无效（需 ReviewDecision.subjectType = 'finding'）
   * - ignored：低置信度自动过滤，不进入归一化流程
   */
  status: 'pending' | 'merged' | 'dismissed' | 'ignored'

  createdAt: string
}
```

辅助类型：

```ts
type EvidenceRef = {
  kind: 'file' | 'line_range' | 'report' | 'test_case' | 'snapshot' | 'url' | 'message'
  ref: string
  excerpt?: string
}

type TargetRef = {
  kind: 'repository' | 'module' | 'package' | 'service' | 'file' | 'component' | 'api' | 'screen'
  ref: string
}
```

#### 4.1.1 FindingMergeRecord（归并协议）

FindingMergeRecord 记录多条 Finding 合并为一个 Issue 的过程，是归并操作的审计凭证。

```ts
type FindingMergeRecord = {
  id: string
  targetIssueId: string          // 合并目标 Issue
  mergedFindingIds: string[]     // 参与合并的 Finding id 列表

  /**
   * 归并触发方式：
   * - auto_cluster：系统自动聚类（基于 affectedTargets 重叠 + categories 相同）
   * - human_merge：人工手动合并
   * - rule_match：归并规则引擎命中（如相同 sourceRef + 相同 categories）
   */
  trigger: 'auto_cluster' | 'human_merge' | 'rule_match'

  /**
   * 聚类依据（auto_cluster 时使用）：
   * - same_target：相同受影响目标
   * - same_category：相同分类
   * - semantic_similarity：语义相似（由 Agent 判断）
   * - same_source_ref：相同工具输出引用
   */
  clusterBasis?: Array<'same_target' | 'same_category' | 'semantic_similarity' | 'same_source_ref'>

  mergedBy?: string   // 操作者（人工合并时填写）
  mergedAt: string
}
```

**归并后的 Finding 状态更新规则**：
- 参与合并的 Finding.status 统一变为 `merged`

**终态拦截（防回归静默 & 防告警风暴）**：

若系统试图将 Finding 归并到一个已处于终态的历史 Issue，**必须按终态语义精确区分处理方式**，而非一律弹窗：

**情形 A：目标 Issue 处于 `closed`（已修复，疑似回归）**
→ **禁止直接归并**，必须执行以下之一：
1. **优先 Reopen**：将目标 Issue 状态重置为 `open`，设置 `isRegression: true`，通知相关人员
2. **若无法 Reopen**（已归档超期）：强制新建独立 Issue，设置 `isRegression: true` 并关联原 Issue id

**情形 B：目标 Issue 处于 `wont_fix` / `accepted_risk` / `deferred`（主动决策，已知风险）**
→ **执行静默归并**：新 Finding 自动继承 `dismissed` 或 `ignored` 状态，不唤醒 Issue，不触发任何告警。
这是因为：团队已经评审过这个问题并明确决定"不修"或"已知晓风险"，每次扫描器重新发现就弹窗只会引发告警疲劳（Alert Fatigue），最终导致系统被拉黑。
→ **例外**：若代码发生**实质性变更**（`isRegression: true` 条件由系统通过 git diff 验证），才升级为 Reopen 或新建。

```ts
// Issue 新增回归标记字段
type Issue = {
  // ...现有字段...
  isRegression?: boolean       // 该 Issue 是否为已修复问题的回归
  regressionOfIssueId?: string // 回归自哪个已关闭的 Issue（可追溯）
}
```

此机制确保回归缺陷不会因聚类规则被静默吞噬为"已解决"，始终触发新的治理流程。

**归并聚类建议维度（优先级从高到低）**：
1. 完全相同的 `affectedTargets` + `categories` → 强信号，可自动合并
2. 相同 `affectedTargets` 但 categories 不同 → 创建关联关系，不自动合并
3. 语义相似但 targets 不同 → 仅标记 `tags` 关联，不合并

---

### 4.2 Issue

Issue 表示经过归一化后的正式问题项，是进入 backlog 的对象。

```ts
type Issue = {
  id: string
  title: string
  statement: string

  kind: 'bug' | 'risk' | 'debt' | 'improvement' | 'gap' | 'violation'

  /**
   * 归一化后的正式分类，使用 CategoryTaxonomy 中的 key。
   * 归一化规则：取合并的所有 Finding.categories 的并集，
   * 再由归一化 Agent 根据 rootCause 和 impactSummary 做最终确认与精简。
   */
  categories: string[]
  tags: string[]

  relatedFindingIds: string[]    // 来源 Finding（可来自多条 Finding 的归并）

  status:
    | 'open'           // 初始状态，已归一化但尚未评估
    | 'planned'        // 已生成 ChangePlan，等待审批
    | 'in_progress'    // 已有 ChangeUnit 进入 running 状态
    | 'blocked'        // 执行遇到阻塞（依赖未就绪 / 冲突 / 人工干预中）
    | 'in_review'      // 所有活跃 ChangeUnit 已 verified，等待人工 review
    | 'resolved'       // 所有活跃 ChangeUnit 已 committed 且 verified
    | 'partially_resolved'   // 部分 ChangeUnit 被 cancelled，其余已成功交付
    | 'integration_failed'    // 所有活跃 CU verified，但 Plan 级集成 E2E 验证失败
    | 'closed'         // 已 resolved/partially_resolved 并交付（或已 merged）
    | 'deferred'       // ResolutionDecision = defer，休眠挂起，移出活跃轮询视图
    | 'accepted_risk'  // ResolutionDecision = accept_risk
    | 'wont_fix'       // ResolutionDecision = wont_fix
    | 'duplicate'      // 标记为重复，关联到主 Issue

  affectedTargets: TargetRef[]
  rootCause?: string
  impactSummary: string

  createdAt: string
  updatedAt: string
}
```

#### 4.2.1 Issue 状态机

```
open
  ──[有 ChangePlan 被批准]──► planned
  ──[ResolutionDecision = accept_risk]──► accepted_risk（终态）
  ──[ResolutionDecision = wont_fix]──► wont_fix（终态）
  ──[ResolutionDecision = duplicate]──► duplicate（终态）
  ──[ResolutionDecision = defer]──► deferred（休眠，移出活跃轮询视图，等 Cron Job 到期唤醒）

deferred
  ──[deferUntil 到期，Cron Job 原子唤醒]──► open
  ──[人工提前解除延期]──► open
  ──[人工决定放弃]──► wont_fix（终态）

planned
  ──[有 ChangeUnit 进入 running]──► in_progress
  ──[ChangePlan 被 rejected]──► open（重新规划）

in_progress
  ──[所有【活跃（非 cancelled）】ChangeUnit verified，且 Plan 级集成验证通过]──► in_review
  ──[所有【活跃（非 cancelled）】ChangeUnit verified，但 Plan 级集成验证失败]──► integration_failed
  ──[有 ChangeUnit exhausted 且需人工决策]──► blocked
  ──[有 ChangeUnit cancelled 且无后继，其余已 verified]──► in_review（部分成功流转，若有 Plan 级验证则需通过）
  ──[执行遇到依赖 / 冲突问题]──► blocked

blocked
  ──[人工介入解除阻塞]──► in_progress
  ──[人工决定放弃]──► wont_fix（终态）

integration_failed（等待人工排查或回滚）
  ──[人工 edit_and_continue（修复集成冲突后）]──► in_review
  ──[人工打回重新规划（作废当前 ChangePlan）]──► open（ChangePlan 标记 superseded）

in_review
  ──[ReviewDecision = approved，且所有 ChangeUnit committed]──► resolved
  ──[ReviewDecision = approved，且有 ChangeUnit cancelled]──► partially_resolved
  ──[ReviewDecision = rejected / retry]──► in_progress

resolved
  ──[DeliveryArtifact merged]──► closed（终态）

partially_resolved
  ──[DeliveryArtifact merged（仅成功部分）]──► closed（终态）
     ⚑ Spin-off 协议：系统自动将 cancelled / exhausted 的 ChangeUnit 剥离，
        为每个未完成单元派生（Spin-off）一个新的 open Issue，
        防止未完成的技术债从 backlog 蒸发。新 Issue 保留原 sourceActionId 追溯链。
```

---

### 4.3 IssueAssessment

IssueAssessment 表示对 Issue 的评估结果。

```ts
type IssueAssessment = {
  issueId: string

  severity: 'critical' | 'high' | 'medium' | 'low'
  priority: 'p0' | 'p1' | 'p2' | 'p3'

  /**
   * 危险程度评分（决定 priority），统一量纲：整数 0–10。
   * - userImpact：对终端用户的影响程度（0=无影响，10=完全阻塞核心用户流程）
   * - systemRisk：引入系统级故障或数据损坏的风险（0=无风险，10=高概率导致故障）
   * - strategicValue：修复后对产品/技术目标的贡献（0=无关战略，10=核心战略目标）
   *
   * 【Priority 加权公式（v3 修订）】：
   *   priorityScore = w_userImpact * userImpact
   *                 + w_systemRisk * systemRisk
   *                 + w_strategicValue * strategicValue
   *
   *   ⚠️ fixCost 已从 priority 公式中移除：
   *   "修复代价大"不能降低问题的危险程度（否则极高代价的致命安全漏洞会被错误降为 P3）。
   *   fixCost 仅用于 autoActionEligibility 判断（见下方说明）。
   */
  userImpact: number      // 0–10
  systemRisk: number      // 0–10
  strategicValue: number  // 0–10

  /**
   * 修复代价评分（仅影响 autoActionEligibility，不影响 priority）。
   * - fixCost：修复所需资源投入（0=几行代码，10=需要重大架构重写）
   *
   * autoActionEligibility 判断参考规则（可通过 AutoActionPolicy 覆盖）：
   *   fixCost >= 8 → forbidden（禁止自动修改，强制要求人工架构评审）
   *   fixCost >= 5 → human_review_required
   *   fixCost < 5  → 参照其他 AutoActionPolicy 规则决定
   */
  fixCost: number         // 0–10（越高代表代价越大，仅影响执行资格）

  /**
   * 自动化执行资格，最终生效值由以下规则确定：
   * 1. 首先检查 AutoActionPolicy 规则引擎（§5.3）是否有匹配规则 → 若命中，以 Policy 结果为准
   * 2. Policy 未命中时，使用 Assessment 中 Agent / rule_engine / human 评估的结果
   * 3. 人工通过 ReviewDecision(subjectType='assessment') 覆盖时，以人工覆盖为最高优先级
   *
   * 优先级顺序：human override > AutoActionPolicy > Assessment
   */
  autoActionEligibility:
    | 'auto_allowed'
    | 'human_review_required'
    | 'suggest_only'
    | 'forbidden'

  rationale: string[]
  assessedBy: 'agent' | 'rule_engine' | 'human' | 'hybrid'
  assessedAt: string
}
```

---

### 4.4 ResolutionDecision

ResolutionDecision 表示该 Issue 的处置决策。

```ts
type ResolutionDecision = {
  issueId: string
  resolution:
    | 'fix'
    | 'refactor'
    | 'mitigate'
    | 'accept_risk'
    | 'defer'
    | 'duplicate'
    | 'wont_fix'
    | 'needs_human_decision'

  reason: string

  /**
   * 仅当 resolution = 'defer' 时有意义。
   * 指定重新评估日期，系统应在此日期后自动将该 Issue 重新推入评估队列。
   * 若不填写，默认 30 天后重新评估。
   */
  deferUntil?: string   // ISO 8601 日期字符串

  /**
   * 仅当 resolution = 'duplicate' 时填写，指向主 Issue id。
   */
  primaryIssueId?: string

  approvedBy?: string
  decidedAt: string
}
```

---

### 4.5 ChangePlan

ChangePlan 表示针对一个 Issue 的处理方案。

```ts
type ChangePlan = {
  id: string
  issueId: string

  objective: string
  strategy: string
  affectedTargets: TargetRef[]

  /**
   * 计划中的动作列表。每个 ChangeAction 对应后续派生的一个或多个 ChangeUnit。
   * ChangeUnit.sourceActionId 引用此处的 ChangeAction.id，建立 Plan → Unit 的派生链。
   */
  proposedActions: ChangeAction[]
  risks: string[]
  rollbackPlan?: string
  assumptions?: string[]

  /**
   * 生成本 Plan 时的代码基线 Commit SHA（由 Pipeline D 执行时自动写入）。
   *
   * Pipeline E 在执行（running）的第一步执行**靶向文件 Diff 校验**：
   *
   *   git diff <baselineCommitSha> HEAD -- <affectedTargets 中的文件列表>
   *
   * 判定规则：
   * - 若 diff 结果为空（目标文件未被他人修改）：正常执行，无论 HEAD 是否超前
   * - 若 diff 结果非空（目标文件已被他人修改或产生物理冲突）：
   *     拦截执行，将 ChangePlan 标记为 superseded，触发重新规划（回到 Pipeline D）
   *
   * ⚠️ 不使用全局 SHA 对比：大型高活跃仓库中 HEAD 每几分钟就会因无关提交而变动，
   * 全局校验会导致无关文件的变更阻断当前执行，使自动修复成功率趋近于 0。
   */
  baselineCommitSha: string

  status: 'draft' | 'approved' | 'rejected' | 'superseded'
  createdAt: string
}

type ChangeAction = {
  id: string
  type:
    | 'code_change'
    | 'test_addition'
    | 'test_fix'
    | 'config_change'
    | 'dependency_upgrade'
    | 'doc_update'
    | 'ux_adjustment'
    | 'architecture_refactor'
    | 'observability_change'
  description: string
  targets: TargetRef[]
}
```

---

### 4.6 ChangeUnit

ChangeUnit 表示最小执行单元，派生自 `ChangePlan.proposedActions` 中的某个 `ChangeAction`。

```ts
type ChangeUnit = {
  id: string
  changePlanId: string
  issueId: string

  /**
   * 派生来源：指向 ChangePlan.proposedActions 中对应 ChangeAction 的 id。
   * 一个 ChangeAction 可以拆分为多个 ChangeUnit（如范围过大时），
   * 但每个 ChangeUnit 必须能追溯到唯一的 sourceActionId。
   */
  sourceActionId: string

  /**
   * 前置依赖的 ChangeUnit id 列表，支持有向无环图（DAG）执行调度。
   * 执行引擎在将 ChangeUnit 从 pending 推进到 ready 前，
   * 必须验证所有 dependsOnUnitIds 中的 ChangeUnit 均已达到 verified / committed 状态。
   * 空列表表示无依赖，可立即进入 ready。
   */
  dependsOnUnitIds: string[]

  title: string
  description: string

  scope: {
    targets: TargetRef[]
    maxFiles?: number
    maxDiffLines?: number
    /**
     * 超出 scope 约束时的处理策略：
     * - fail：执行失败，需人工处理
     * - split：自动拆分为多个 ChangeUnit（需系统支持）
     * - warn：记录警告但继续执行
     */
    violationPolicy: 'fail' | 'split' | 'warn'
  }

  executionMode: 'auto' | 'semi_auto' | 'manual'

  /**
   * 执行预算（防 AI 无限重试熔断）：
   * - maxRetries：允许的最大重试次数（默认建议 3）
   * - currentAttemptNo：当前是第几次执行（从 1 开始），每次进入 running 时 +1
   * 当 currentAttemptNo > maxRetries 时，状态机强制跃迁至 exhausted，截断循环
   */
  maxRetries: number          // 默认 3，auto 模式下强制要求
  currentAttemptNo: number    // 初始值 0，每次 running 前 +1

  status:
    | 'pending'              // 已创建，等待前置条件就绪
    | 'ready'                // 前置条件就绪，可以执行
    | 'running'              // 正在执行（Agent 或人工操作中）
    | 'verification_failed'  // 验证未通过，需修正
    | 'verified'             // 验证通过，等待 commit / 人工确认
    | 'committed'            // 已生成 commit
    | 'merged'               // 已合入主干
    | 'cancelled'            // 已取消
    | 'exhausted'            // 重试预算耗尽，强制终止等待人工接管

  producedCommitIds: string[]

  createdAt: string
  updatedAt: string
}
```

#### 4.6.1 ChangeUnit 状态机

```
pending
  ──[dependsOnUnitIds 全部达到 verified/committed，或列表为空]──► ready

ready
  ──[执行开始（auto / semi_auto / manual）]──► running

running
  ──[验证通过]──► verified
  ──[验证失败 且 currentAttemptNo <= maxRetries]──► verification_failed
  ──[验证失败 且 currentAttemptNo > maxRetries]──► exhausted（强制终止，呼叫人工）
  ──[手动取消]──► cancelled

verification_failed
  ──[修正后重新执行（currentAttemptNo + 1）]──► running
  ──[人工 edit_and_continue]──► verified
  ──[人工 skip]──► cancelled（跳过本 ChangeUnit，不影响 Issue 整体）
  ──[人工 terminate]──► cancelled

verified
  ──[autoActionEligibility = auto_allowed 且 DeliveryPolicy 允许自动提交]──► committed
  ──[需人工确认（human_review_required）]──► 等待 ReviewDecision
  ──[ReviewDecision = approved]──► committed
  ──[ReviewDecision = rejected]──► running（重新执行）

exhausted（终态）
  ──[人工 edit_and_continue]──► verified（人工接管最后一里路，如补 import / 修路径，直接推进流程，无需重置预算重跑 AI）
  ──[人工 ReviewDecision = retry]──► ready（同时重置 currentAttemptNo 和 maxRetries 预算，让 AI 重新完整执行）
  ──[人工 ReviewDecision = terminate]──► cancelled（终态）

committed
  ──[DeliveryArtifact merged]──► merged（终态）
  ──[DeliveryArtifact closed 未合入]──► committed（保留记录）
```

---

### 4.7 VerificationPlan

VerificationPlan 表示验证步骤集合，支持两种粒度：

- **CU 级（change_unit）**：与 ChangeUnit **1:1 绑定**，每次执行后追加一条 VerificationResult。重点跑 lint / typecheck / 局部单测，执行快，不依赖其他 ChangeUnit 完成。
- **Plan 级（change_plan）**：与 ChangePlan 绑定，在**所有活跃 ChangeUnit 完成后**触发一次聚合运行，跑全局构建、集成测试和 E2E，作为 DeliveryArtifact 的最终质量门禁。

```ts
type VerificationPlan = {
  id: string

  /**
   * 验证粒度：
   * - change_unit：与单个 ChangeUnit 绑定（1:1），跑局部轻量验证
   * - change_plan：与 ChangePlan 绑定，所有活跃 CU 完成后跑集成 E2E
   */
  subjectType: 'change_unit' | 'change_plan'

  changeUnitId?: string    // subjectType = 'change_unit' 时必填
  changePlanId?: string    // subjectType = 'change_plan' 时必填
  issueId?: string         // 可选，用于关联 Issue 级追踪

  checks: VerificationCheck[]

  /**
   * 通过标准，自然语言描述，供人工 review 和 AI 评估参考。
   * 示例：["所有 required checks 通过", "lint 零报错", "单测覆盖率不低于修改前"]
   */
  passCriteria: string[]

  createdAt: string
}

type VerificationCheck = {
  id: string
  type:
    | 'lint'
    | 'typecheck'
    | 'unit_test'
    | 'integration_test'
    | 'e2e_test'
    | 'a11y_check'
    | 'coverage_check'
    | 'static_scan'
    | 'build'
    | 'custom'
  target?: string
  command?: string
  required: boolean
}
```

---

### 4.8 VerificationResult

VerificationResult 表示实际验证结果。**VerificationPlan 与 ChangeUnit 保持 1:1 绑定（验证标准不变），但每次重试都追加一条新的 VerificationResult（1:N），完整保留每次执行的验证快照**，防止失败历史被覆写，并为后续 SFT/RLHF 训练提供完整的"负样本演进数据集"。

```ts
type VerificationResult = {
  id: string
  verificationPlanId: string

  /**
   * 验证主体类型，与 VerificationPlan.subjectType 保持一致：
   * - change_unit：CU 级局部验证结果
   * - change_plan：Plan 级集成 E2E 验证结果
   */
  subjectType: 'change_unit' | 'change_plan'
  changeUnitId?: string    // subjectType = 'change_unit' 时必填
  changePlanId?: string    // subjectType = 'change_plan' 时必填

  /**
   * 对应 ChangeUnit.currentAttemptNo 的快照，标识这是第几次执行的验证结果。
   * subjectType = 'change_plan' 时此字段为 1（Plan 级集成验证通常只跑一次）。
   */
  executionAttemptNo: number

  status: 'passed' | 'failed' | 'partial'
  checkResults: Array<{
    checkId: string
    status: 'passed' | 'failed' | 'skipped'
    summary: string
    artifactRefs?: string[]
  }>

  summary: string
  executedAt: string
}
```

---

### 4.9 ReviewDecision

ReviewDecision 表示人工审批结果。

```ts
type ReviewDecision = {
  id: string

  /**
   * 审批对象类型：
   * - finding：Finding 层面的误报撤销（dismiss 一个 Finding，阻止其进入归一化流程）
   * - assessment：IssueAssessment 结论的人工覆盖（修正 Agent 打分不准的 severity / priority / autoActionEligibility）
   * - issue：Issue 级审批（如 ResolutionDecision 需要人工确认）
   * - change_plan：ChangePlan 审批（批准/拒绝变更方案）
   * - change_unit：ChangeUnit 执行结果审批
   * - delivery_artifact：PR / MR 最终合入审批
   */
  subjectType:
    | 'finding'
    | 'assessment'
    | 'issue'
    | 'change_plan'
    | 'change_unit'
    | 'delivery_artifact'
  subjectId: string

  decision:
    | 'approved'
    | 'rejected'
    | 'retry'
    | 'edit_and_continue'
    | 'skip'
    | 'terminate'
    | 'accepted_risk'
    | 'dismissed'    // 仅用于 finding（误报撤销）

  /**
   * 仅当 subjectType = 'assessment' 时使用，提供人工覆盖的字段值。
   * 例如：{ severity: 'low', autoActionEligibility: 'auto_allowed' }
   */
  assessmentOverride?: Partial<Pick<IssueAssessment, 'severity' | 'priority' | 'autoActionEligibility'>>

  comment?: string
  reviewer: string
  createdAt: string
}
```

---

### 4.10 DeliveryArtifact

DeliveryArtifact 表示最终交付物，不绑死到 PR。

```ts
type DeliveryArtifact = {
  id: string
  kind: 'pull_request' | 'merge_request' | 'review_request' | 'report'
  title: string
  body: string

  linkedIssueIds: string[]
  linkedChangeUnitIds: string[]
  linkedVerificationResultIds: string[]

  /**
   * 当关联多个 Issue / ChangeUnit 时，title 和 body 的生成策略：
   * - auto_aggregate：系统自动聚合（标题取最高优先级 Issue 的 title，body 列出所有 Issue 摘要）
   * - human_authored：人工填写 title 和 body（系统不自动生成）
   * - template：使用预定义模板，变量由系统填充
   */
  bodyStrategy: 'auto_aggregate' | 'human_authored' | 'template'

  externalRef?: string   // PR / MR 在外部系统（GitHub / GitLab 等）的链接
  status: 'draft' | 'submitted' | 'merged' | 'closed'

  createdAt: string
}
```

---

## 5. 策略配置模型

### 5.1 CategoryTaxonomy

```ts
type CategoryTaxonomy = {
  categories: Array<{
    key: string
    label: string
    description?: string
    parentKey?: string
  }>
}
```

建议默认 taxonomy：`architecture / maintainability / clean_code / testing / ux / a11y / security / performance / observability / dependency / release_risk`

---

### 5.2 PriorityPolicy

```ts
type PriorityPolicy = {
  /**
   * 仅对三个危险程度维度设权重（fixCost 已移出 priority 公式）：
   */
  weights: {
    userImpact: number      // 建议值：0.40
    systemRisk: number      // 建议值：0.40
    strategicValue: number  // 建议值：0.20
  }
  /**
   * 加权得分阈值（取值范围约 0 ~ 10）：
   * score >= p0 → P0；score >= p1 → P1；score >= p2 → P2；其余 → P3
   */
  thresholds: {
    p0: number   // 建议值：8.0
    p1: number   // 建议值：5.0
    p2: number   // 建议值：2.5
    p3: number   // 建议值：0（兜底）
  }
}
```

---

### 5.3 AutoActionPolicy

```ts
type AutoActionPolicy = {
  /**
   * 规则按顺序匹配，第一条命中的规则生效（优先于 IssueAssessment.autoActionEligibility）。
   * 若无规则命中，使用 Assessment 的评估值；若人工通过 ReviewDecision 覆盖，则最终以人工为准。
   */
  rules: Array<{
    match: {
      categories?: string[]
      severity?: Array<'critical' | 'high' | 'medium' | 'low'>
      targets?: string[]
    }
    action: 'auto_allowed' | 'human_review_required' | 'suggest_only' | 'forbidden'
  }>
}
```

---

### 5.4 DeliveryPolicy

```ts
type DeliveryPolicy = {
  defaultArtifactKind: 'pull_request' | 'merge_request' | 'review_request'
  commitGranularity: 'one_issue_one_commit' | 'one_change_unit_one_commit' | 'configurable'
  requireVerificationBeforeDelivery: boolean
}
```

---

## 6. 系统能力分层

建议系统分为四层。

### 6.1 发现层

负责收集原始信号并产出 Finding，维护 Finding 生命周期状态。

来源包括：Agent review、静态扫描、测试失败、覆盖率报告、UX / a11y 报告、人工反馈、依赖扫描。

### 6.2 决策层

负责将 Finding 归一化为 Issue（含归并聚类），并完成评估与优先级排序。

能力包括：Finding 聚类与归并（生成 FindingMergeRecord）、根因归并、严重度评估（产出 IssueAssessment）、自动化资格判断（结合 AutoActionPolicy）、处置决策（产出 ResolutionDecision）。

### 6.3 执行层

负责将 ChangePlan 落地为 ChangeUnit，并真正对代码/配置/文档进行变更。

能力包括：工作区准备、执行范围控制（scope 约束检查与 violationPolicy 执行）、文件编辑、commit 编排、分支管理、并行执行冲突检测。

### 6.4 验证与交付层

负责验证 ChangeUnit 效果并生成交付物。

能力包括：局部验证、回归验证、静态扫描复检、PR / MR / 报告生成、人工审批（ReviewDecision）。

---

## 7. 下一步方案设计

为了降低风险，建议分三阶段落地。

### 7.1 阶段一：先做问题治理前半链

**目标**：先把"发现 → 归并 → 归一化 → 排序 → 方案生成"做稳定。

**范围**：Finding ingestion + 生命周期管理、FindingMergeRecord + 归并聚类、Issue normalization + 状态机、IssueAssessment、ResolutionDecision（含 deferUntil）、ChangePlan + ChangeUnit 定义（含 sourceActionId 派生链）、VerificationPlan。

**输出**：问题清单、优先级 backlog、处理方案、验证步骤。

**暂不实现**：自动改代码、自动 commit、自动 PR。

---

### 7.2 阶段二：做单项可控自动执行

**目标**：实现"一个 ChangeUnit 一次执行，一次验证，一次提交"。

**范围**：ChangeUnit 状态机驱动、Workspace execution、scope violationPolicy 执行、Verification runner（1:1 VerificationPlan）、Commit orchestration、并行执行冲突检测（同文件锁定机制）。

**执行策略建议**：
- 默认 1 个 ChangeUnit 对应 1 个主 commit
- 高风险 Issue 仅允许 suggest_only
- 限制单次最大改动文件数和 diff 行数，violationPolicy 默认为 `warn`

**输出**：每项问题对应变更记录、对应验证结果、对应 commit。

---

### 7.3 阶段三：做完整交付闭环

**目标**：实现可审查、可交付的完整闭环。

**范围**：Branch orchestration、DeliveryArtifact builder（含多 Issue 聚合策略）、Review flow（ReviewDecision 全链路）、Merge readiness gate。

**输出**：PR / MR / Review 单、变更摘要、验证汇总、风险说明。

---

## 8. 推荐的多 Pipeline 设计

建议最终拆成 5 条 Pipeline。

### 8.0 Pipeline 间数据流协议

**传递方式**：所有 Pipeline 共享同一数据存储（如关系型数据库），通过 id 引用传递对象，不通过消息队列复制数据体。Pipeline 之间的触发关系如下：

```
Pipeline A（一次性 / 按需重跑）
  └─ 产出 RepositoryProfile，写入 DB
      ↓
Pipeline B（可并发多次运行）
  └─ 读取 RepositoryProfile，产出 Finding 列表（status=pending），写入 DB
      ↓
Pipeline C（消费 pending Finding）
  └─ 读取 Finding，产出 Issue + IssueAssessment + FindingMergeRecord，写入 DB
      ↓（等待 ResolutionDecision，可由人工或 Agent 产出）
Pipeline D（消费已有 ResolutionDecision 的 Issue）
  └─ 读取 Issue + ResolutionDecision，产出 ChangePlan + ChangeUnit + VerificationPlan，写入 DB
      ↓（等待 ChangePlan 审批）
Pipeline E（消费已批准 ChangeUnit）
  └─ 读取 ChangeUnit，产出 VerificationResult + commit + DeliveryArtifact，写入 DB
```

**触发条件**：每条 Pipeline 的触发基于 DB 状态查询（轮询或事件通知），而非 Pipeline 间直接调用。

**分布式并发防踩踏**：多节点部署下，多个 Worker 可能同时轮询到同一批 Finding/Issue。为防止重复处理（同一 Finding 被插入多条 Issue），每个待处理实体引入 **`ownerLeaseToken` 租约锁 + `version` 乐观锁**：

```sql
-- Worker 认领任务时（以 Finding 为例）
UPDATE Finding
SET ownerLeaseToken = <workerId>,
    leaseExpiresAt  = NOW() + INTERVAL '5 MINUTE',
    version         = version + 1
WHERE id = <findingId>
  AND status = 'pending'
  AND (ownerLeaseToken IS NULL OR leaseExpiresAt < NOW())
  AND version = <expectedVersion>
-- rowCount = 0 表示已被其他 Worker 抢占，跳过

-- 状态写回时同样带版本校验
UPDATE Finding SET status = 'merged', version = version + 1
WHERE id = <findingId> AND version = <expectedVersion>
```

Worker 持有租约期间定时续约（建议每 60s），OOM/宕机后租约自动过期，其他 Worker 可安全接管。此机制与 plan-pipeline-design 中的 Worker 调度方案保持一致。

---

### 8.1 Pipeline A：Repository Baseline

**输入**：仓库、分支、构建/测试入口

**输出**：`RepositoryProfile`（写入 DB，供后续 Pipeline 读取）

```ts
type RepositoryProfile = {
  repositoryId: string
  branch: string
  snapshotAt: string

  modules: Array<{
    name: string
    path: string
    language: string
    dependencies: string[]
  }>

  testBaseline: {
    coveragePercent?: number
    totalTests: number
    failingTests: number
    lastRunAt?: string
  }

  buildStatus: 'passing' | 'failing' | 'unknown'

  metadata?: Record<string, unknown>
}
```

---

### 8.2 Pipeline B：Issue Discovery

**输入**：仓库、工具输出、Agent review、`RepositoryProfile`（来自 Pipeline A）

**输出**：Finding 列表（`status = 'pending'`）

---

### 8.3 Pipeline C：Issue Triage

**输入**：`status = 'pending'` 的 Finding 列表、`RepositoryProfile`（提供模块上下文）

**输出**：Issue、IssueAssessment、FindingMergeRecord、prioritized backlog

---

### 8.4 Pipeline D：Change Planning

**输入**：Issue（已有 ResolutionDecision，resolution 为 `fix / refactor / mitigate`）、`RepositoryProfile`（提供模块边界）

**输出**：ChangePlan（含 ChangeAction 列表）、ChangeUnit（含 sourceActionId）、VerificationPlan（1:1 绑定 ChangeUnit）

---

### 8.5 Pipeline E：Change Execution & Delivery

**输入**：已批准的 ChangeUnit（`status = 'ready'`）

**输出**：VerificationResult、commit、DeliveryArtifact

---

## 9. 第一阶段最应该先补的能力

### P0

1. Finding（含 status 生命周期）+ FindingMergeRecord + 归并聚类协议
2. Issue（含状态机）+ IssueAssessment（含评分量纲与加权公式）
3. ChangePlan（含 ChangeAction）+ ChangeUnit（含 sourceActionId 派生链、violationPolicy）
4. VerificationPlan（1:1 绑定 ChangeUnit）+ VerificationResult

### P1

5. ResolutionDecision（含 deferUntil 与 primaryIssueId）
6. ReviewDecision（含 finding 和 assessment subjectType）
7. AutoActionPolicy（含优先级规则：Policy > Assessment，人工覆盖最高）
8. Taxonomy / PriorityPolicy（含量纲说明）/ DeliveryPolicy

### P2

9. RepositoryProfile + Pipeline A
10. DeliveryArtifact（含 bodyStrategy）
11. Commit orchestration、Branch / PR orchestration
12. 并行执行与冲突处理（同文件锁定机制）

---

## 10. 可直接用于文档的系统定位

> 本系统不是面向单一"缺陷修复"的专用流水线，而是一个面向软件工程问题治理的通用编排系统。
> 它支持从多源发现中归一化形成 Issue，基于策略完成评估与优先级排序，生成 ChangePlan 与 ChangeUnit，执行验证与交付，并支持人工审批与风险接受。
> 在具体场景中，该系统可实例化为架构缺陷治理、Clean Code 改进、测试补全、UX 优化、依赖治理、安全修复等多类工作流。

---

## 11. 结论

本设计建议将"架构缺陷发现与修复"上升为"通用问题发现与变更治理"能力域。核心思路是：

1. 用通用模型承载对象本身，用策略配置表达组织当前的分类与处理规则
2. 用 FindingMergeRecord 定义归并协议（终态拦截精细区分：`closed` 触发 reopen；`wont_fix`/`accepted_risk`/`deferred` 静默归并，防告警风暴）
3. 为 Issue 和 ChangeUnit 定义完整状态机，含 `deferred` 休眠、`exhausted` 熔断、`partially_resolved` 部分成功、`integration_failed` 集成失败四个关键扩展态
4. ChangeUnit 引入执行预算（maxRetries + currentAttemptNo）+ DAG 依赖（dependsOnUnitIds）；exhausted 新增 `edit_and_continue` 微操出口
5. VerificationPlan 支持双粒度拓扑（CU 级局部 + Plan 级集成）；VerificationResult 新增 subjectType 与 changePlanId，消除 Schema 冲突；结果以 1:N 追加保存
6. ChangePlan 基线校验从"全局 SHA 对比"降级为"靶向文件 Diff"，高活跃仓库不再被无关提交误杀
7. Spin-off 协议：partially_resolved → closed 时自动将未完成 ChangeUnit 派生为新 Issue，防止技术债蒸发
8. Priority 打分器重构：fixCost 移出 priority 公式，仅影响 autoActionEligibility
9. Pipeline 任务消费引入 ownerLeaseToken + version 乐观锁，防止多 Worker 并发踩踏
10. 通过 AutoActionPolicy 优先级规则统一自动化资格判断入口

采用该方案后，系统既可以服务当前的软件开发缺陷治理需求，也能在未来扩展到更广义的软件工程质量治理场景，而不需要推倒重来。
