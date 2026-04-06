# 自循环治理项目第一阶段方案（评审稿）

> 状态：待评审  
> 目标：基于现有仓库能力，先实现“自循环治理项目”的第一阶段闭环，只覆盖**梳理文档、发现缺陷、修复缺陷**，不扩展新功能开发。

---

## 1. 文档目的

本文档回答三件事：

1. 当前项目已经具备哪些与 Agent 自动化治理相关的能力
2. 当前能力为什么还不足以支撑“自循环治理项目”
3. 第一阶段应该实现什么、怎么实现、明确不做什么

本文档是自包含的评审材料，不要求先阅读已有设计文档或代码。

---

## 2. 我们的总体目标

我们的长期目标不是做一个单点 Agent，也不是做一个单条自动化流程，而是做一个**可自治运转的软件工程系统**。

这个系统的目标形态是：

- 一个项目空间内存在多条 Pipeline
- 每条 Pipeline 负责一种事务，例如文档维护、缺陷发现、缺陷修复、测试维护、架构维护、后续的特性开发
- Pipeline 内部可以动态展开多个任务
- 多个 Agent 以任务执行者的身份参与这些事务
- 整个系统在**无人干预或最小人工干预**下持续运转

从能力视角看，我们的总体目标包括：

1. 持续维护代码
2. 持续维护文档
3. 持续维护架构约束
4. 自主执行测试并发现问题
5. 自主修复可自动修复的问题
6. 在后续阶段逐步扩展到特性调研与特性开发

但这个总体目标不能一步到位。  
如果现在直接追求“完备自治开发团队”，项目会同时面对：

- 编排模型不统一
- 运行边界不清楚
- 风险控制不足
- 副作用不可控
- 治理闭环尚未跑通

因此，必须先把范围收紧，先做一个可稳定运行的第一阶段。

---

## 3. 第一阶段目标

第一阶段只做“**治理闭环**”，不做“**新功能扩展**”。

### 3.1 第一阶段在总体目标中的位置

第一阶段不是最终目标，而是总体目标的第一个落地点。

它的定位是：

- 先做维护型自治
- 先做低风险、可验证、可回收的自治任务
- 先把“发现问题 -> 修复问题 -> 同步文档 -> 验证结果”这条闭环跑通

只有这一阶段跑稳了，后续才有资格继续扩展到：

- 测试维护
- 架构维护
- roadmap 调研
- 特性开发

### 3.2 目标能力

第一阶段要跑通以下闭环：

1. 盘点并梳理项目文档
2. 从代码、测试、文档、结构约束中发现问题
3. 将问题整理成可处理的治理任务
4. 自动修复可自动修复的问题
5. 修复后执行验证
6. 将必要的文档同步回项目文档体系

### 3.3 明确不做

第一阶段不做：

- 新业务功能规划
- 新业务功能开发
- 自主产品 roadmap 推进
- 跨项目知识迁移
- 多项目协同
- 自治发布、自治上线

一句话说：**先做维护型自治，不做扩展型自治。**

---

## 4. 为什么第一阶段要先收敛到治理闭环

第一阶段聚焦治理闭环，不是保守，而是为了让评审目标集中、实现路径清晰。

选择治理闭环作为第一阶段，有四个原因：

1. **问题定义更清晰**
   文档问题、缺陷问题、验证问题都比“新功能开发”更容易定义边界。

2. **风险更可控**
   治理任务主要是维护已有系统，不会主动扩展产品能力边界。

3. **更容易验证效果**
   文档是否补齐、缺陷是否修复、测试是否通过，都比“功能价值是否正确”更容易判断。

4. **更适合重构现有系统**
   当前仓库已经有 Governance 领域对象和基础自动化能力，先从这里统一编排最合适。

所以，第一阶段的评审重点不应该分散到“未来所有自治能力”，而应该集中在：

- 当前现状是否支撑治理闭环
- 为了治理闭环需要做哪些重构
- 第一阶段的目标架构是否清晰

---

## 5. 业界对照结论

第一阶段方案的总体方向和业界成熟实践是一致的，但落地方式需要更克制。

### 5.1 编排内核：事务编排正确，自研复杂调度风险过高

业界在长时任务、重试、挂起、恢复、依赖编排上，通常采用：

- `Temporal`
- `AWS Step Functions`
- `BullMQ Flow / Graphile Worker` 这一类现成任务基座

这些系统的共同点是：

- 编排和执行解耦
- 持久化状态机成熟
- 原生支持重试、挂起、恢复、依赖关系

对我们的一期启示是：

- `Pipeline -> TaskRun` 这个方向是对的
- 但一期不应该自己手写一个复杂的分布式调度引擎

### 5.2 执行环境：必须做隔离，不能直接依赖共享物理工作区

业界在 AI 软件工程执行上，通常会引入：

- 独立 Git 分支
- 临时工作区
- 容器或沙箱验证环境

对我们的一期启示是：

- 不能让修复任务直接并发污染主工作区
- `fix_verify` 不能在共享物理环境里裸跑

### 5.3 上下文机制：显式产物是必须的，但仍需要全局只读背景

业界常见做法不是只传一个任务输入，而是同时给 Agent 提供：

- 当前任务输入
- 仓库级只读结构信息
- 代码约束、目录结构、关键类型签名

对我们的一期启示是：

- `TaskArtifact` 是对的
- 但不能让 Agent 只看局部 artifact，不看仓库全局结构

### 5.4 人机协同：高风险挂起最终应回到开发者原生流程

业界更成熟的 HITL 方式通常是：

- 提交 PR
- 人类在 PR 上 review
- 系统根据 review comment 继续修复

对我们的一期启示是：

- 一期可以先保留 `Suspend`
- 但目标交互不应停留在“系统内点通过/拒绝”

---

## 6. 当前项目现状

当前仓库不是从零开始，已经具备较强的基础能力，但编排层还没有统一起来。

### 6.1 Runner 能力已经独立

当前系统已经具备独立的 Runner 抽象层，主要能力包括：

- `AgentRunner` 持久化模型
- `RunnerType` 接口
- `RunnerTypeRegistry` 自动注册运行器
- CLI Runner 公共基座
- Runner 级 schema 校验与健康检查

这部分能力已经可以稳定承接 Claude Code、Cursor CLI、Qwen CLI 等物理运行器。  
对应代码位置：

- `packages/backend/src/modules/agent-runners`

### 6.2 Session 能力已经独立

当前系统已经具备物理 Agent 会话能力，主要包括：

- 创建 / 发送 / 取消 / 重载会话
- 初始化项目工作区
- 注入 `skill / rule / mcp`
- 记录消息、事件、指标、工具调用
- 保存 Runner 状态与平台状态

这意味着“让某个 Runner 在项目工作区内执行一轮任务”已经是现成功能。  
对应代码位置：

- `packages/backend/src/modules/sessions`

### 6.3 Pipeline 能力已经具备基础运行时

当前 Pipeline 主要能力包括：

- `Pipeline / PipelineStage / StageExecutionAttempt / PipelineArtifact / PipelineEvent`
- Worker claim + lease heartbeat
- 线性 stage 推进
- 结构化输出解析与 repair
- 人工 review 暂停点
- artifact 持久化

这套能力说明：项目已经有“流程运行时”的雏形。  
对应代码位置：

- `packages/backend/src/modules/pipelines`

### 6.4 Governance 能力已经具备完整领域模型

当前 Governance 已经有：

- `RepositoryProfile`
- `Finding`
- `Issue`
- `ChangePlan`
- `ChangeUnit`
- `VerificationPlan / VerificationResult`
- baseline / discovery / triage / planning / execution 自动化能力
- stage 级 runner fanout、lease、attempt

这说明“治理领域对象”已经建得比较完整。  
对应代码位置：

- `packages/backend/src/modules/governance`
- `packages/backend/prisma/schema.prisma`

### 6.5 Shared contract 已经具备

当前项目已经把核心类型和 schema 提到 shared 包，包括：

- session schema
- pipeline schema
- governance schema
- runner type / pipeline / governance 的共享类型

这对后续做统一编排非常重要。  
对应代码位置：

- `packages/shared/src/types`
- `packages/shared/src/schemas`

---

## 7. 当前架构现状总结

如果从架构层看，当前系统大致是三层：

1. **底层执行层**
- `AgentRunner`
- `AgentSession`
- Runner stream / workspace / message / event / metric

2. **中间流程层**
- `Pipeline`
- `PipelineStage`
- `StageExecutionAttempt`

3. **治理领域层**
- `RepositoryProfile`
- `Finding`
- `Issue`
- `ChangePlan`
- `ChangeUnit`
- `Verification*`

问题在于，中间流程层和治理领域层之间没有稳定边界。

### 7.1 当前 Pipeline 的真实形态

当前 Pipeline 更接近“线性 stage 工作流”：

- 一条 pipeline 一次只处理一个 `currentStageKey`
- worker claim 的粒度是整条 pipeline
- stage 顺序基本固定
- 适合 plan 生成这类单链路流程

这不是“任务编排系统”，只是“线性流程运行时”。

### 7.2 当前 Governance 的真实形态

当前 Governance 不只是领域模型，还包含一整套专用编排：

- 自动轮询
- stage 级 runner 选择
- fanout
- session bridge
- attempt 生命周期
- 修复 / 规划 / triage / discovery 的调度

这意味着 Governance 一边做领域，一边做运行时，已经超出它应该承担的职责。

### 7.3 当前 Session 的真实形态

当前 Session 是物理执行会话，不是业务任务会话：

- 它知道 runner
- 它知道消息流
- 它知道 workspace
- 它不知道“一个治理任务”的完整上下文

这导致一旦任务跨多次会话、跨 runner、跨恢复过程，业务语义就会散落在多张表和多个模块里。

---

## 8. 当前项目的主要问题

当前最大的问题不是“没有能力”，而是“能力分散在三套系统里，且编排模型不统一”。

### 8.1 Pipeline 仍然是线性 stage 模型

当前 Pipeline 的实际运行方式仍然是：

- claim 一整条 pipeline
- 根据 `currentStageKey` 顺序推进
- stage 是固定的
- 并发粒度是 pipeline，不是 task

这适合 Plan Pipeline，不适合治理系统。

### 8.2 Governance 自带了一套专用编排

当前 Governance 除了领域对象，还自带：

- runner 选择
- fanout
- session bridge
- attempt 生命周期
- discovery / triage / planning / execution 调度

这意味着治理领域和通用编排强耦合在一起，后续会越来越难维护。

### 8.3 Session 是物理会话，不是治理任务会话

当前 `AgentSession` 能解决“Runner 怎么执行”，但不能很好解决：

- 一个治理任务的上下文如何跨多次物理会话保留
- 一个治理任务如何在 fallback 或恢复时延续上下文
- 一个治理任务如何关联多次执行历史

### 8.4 缺少统一的 Task 编排模型

治理场景天然不是一条线：

- 文档盘点后可能分裂出多个文档修正任务
- 缺陷发现后可能生成多个 Issue
- 修复计划后可能生成多个修复任务
- 修复后还需要验证与文档同步

这更像一个动态任务森林，而不是单条 stage 链。

### 8.5 当前系统还不适合直接做“自治开发团队”

虽然底层 Runner、Session、Governance 已经有基础，但当前系统还不适合直接去做：

- 自主规划新功能
- 自主拉 roadmap
- 自主做产品级需求开发

因为治理闭环本身都还没有统一编排起来。

---

### 8.6 一期如果手写复杂调度，会陷入基础设施泥潭

如果一期自己实现完整的：

- DAG 依赖调度
- 分布式 claim
- lease heartbeat
- 恢复与防脑裂
- 多 worker 并发状态机

那么很容易出现：

- 调度器 bug 多于治理逻辑 bug
- 研发精力被状态机细节消耗
- 第一阶段迟迟跑不通闭环

一期的重点应该是“治理闭环”，不是“自研分布式调度引擎”。

### 8.7 共享物理工作区无法支撑安全的自动修复

如果文档任务、缺陷修复任务、验证任务并发读写同一个仓库目录，会出现：

- 文件覆盖
- Git 锁冲突
- 中间态污染
- 验证结果不可信

同时，直接在共享环境中执行 AI 生成的测试和命令，也会带来明显安全风险。

### 8.8 当前方案还缺少防死循环与防退化红线

治理闭环里最危险的一类问题不是“修不好”，而是“为了通过验证而退化代码质量”。

典型风险包括：

- 不断重复“修改 -> 验证失败 -> 再修改”的无限循环
- 通过删测试、删断言、加忽略来“伪修复”
- 对核心模块做过度重构

### 8.9 只传局部任务产物，Agent 会缺少仓库全局背景

如果 `fix_execute` 只拿到一个问题 artifact，它虽然知道“要修什么”，但仍可能不知道：

- 项目目录结构
- 关键模块边界
- 已有工具函数和类型
- 禁止触碰的模块

这会降低修复的稳定性。

### 8.10 纯 LLM 扫描式发现缺陷成本高且幻觉重

如果缺陷发现完全依赖模型通读代码库，问题会很明显：

- 成本高
- 信噪比低
- 可重复性差

发现阶段更适合把传统信号作为主入口，再由 LLM 做归因和分诊。

---

## 9. 为了达成第一阶段目标，需要做哪些现状重构

我们的目标不是继续给现有 Pipeline 或 Governance 打补丁，而是把现有能力重组为可持续演进的治理编排系统。

第一阶段要做的重构，不是“重写一切”，而是“重构边界”。

### 9.1 重构一：把 Pipeline 从线性 stage 流程，升级为事务编排容器

现状：

- Pipeline 以 `currentStageKey` 为核心
- 一条 pipeline 一次只推进一个固定 stage

需要重构为：

- `PipelineDefinition`：定义一类事务
- `PipelineRun`：一次事务执行
- `TaskRun`：事务内最小调度单元

重构目标：

- Pipeline 不再直接表达固定 stage 序列
- Pipeline 负责“事务边界”
- Task 负责“执行边界”

### 9.2 重构二：把 Governance 从“领域+编排”混合体，拆回纯领域

现状：

- Governance 既管理 `Finding / Issue / ChangePlan`
- 又管理自动化调度、runner 选择、fanout、attempt

需要重构为：

- Governance 只保留治理领域对象和领域规则
- 编排运行时迁到 Pipeline / Task 层

重构目标：

- 领域对象继续复用
- 编排逻辑不再继续堆在 Governance 模块里
- 后续一个项目内可有多条治理相关 Pipeline，而不是一个单体 Governance automation

### 9.3 重构三：把“整条 pipeline claim”改成“task claim”

现状：

- worker claim 的粒度是 pipeline
- 不适合动态 fanout
- 不适合多任务并发

需要重构为：

- worker claim `TaskRun`
- 每个 task 独立 lease / retry / suspend / resume

重构目标：

- 支持动态任务树
- 支持并发
- 支持局部失败与局部恢复

### 9.4 重构四：把治理闭环拆成多条 Pipeline，而不是一个万能自动化入口

现状：

- 文档、缺陷发现、缺陷修复都偏向放在一个治理自动化系统里处理

需要重构为：

- `Documentation Pipeline`
- `Defect Discovery Pipeline`
- `Defect Repair Pipeline`

重构目标：

- 每条 Pipeline 只做一种事务
- 降低单条流程的复杂度
- 让生命周期、权限、风险控制更清晰

### 9.5 重构五：把“隐式上下文”收敛到任务产物，而不是散落在模块内部

现状：

- 上下文散在 session message、pipeline state、governance attempt、artifact 里

第一阶段不需要完整 AgentNode 平台，但需要先做到：

- Task 输入明确
- Task 输出明确
- TaskArtifact 成为稳定的任务间传递介质

重构目标：

- 上下游任务通过显式 artifact / 领域对象交互
- 不再依赖隐藏在模块内部的临时状态推进

### 9.6 重构六：一期不自研完整分布式调度，优先接入成熟任务基座或降级实现

第一阶段推荐顺序：

1. 优先接入成熟任务基座，承接任务状态、重试、挂起、恢复
2. 如果一期无法接入，则实现一个**降级版任务运行时**

这个降级版的要求是：

- 先支持单向状态推进
- 先支持有限并发
- 先支持明确的挂起与恢复
- 不追求一步到位做复杂心跳和全量 DAG 语义

### 9.7 重构七：引入 Git 分支隔离和验证沙箱

第一阶段必须建立物理隔离边界：

- 自动修复任务在独立分支内执行
- 验证任务在隔离容器或沙箱中执行
- 不允许多个修复任务直接共享主工作区写入

第一阶段的推荐落地方式不是自建复杂容器编排，而是优先复用现有 CI 基础设施：

- Agent 在独立分支提交修复结果
- 系统触发现有 GitHub Actions / GitLab CI / 内部 CI 流水线
- Task 进入挂起态，等待 CI 回调结果

这样可以把“验证沙箱”优先落成一个成熟、可审计、低成本的外部执行环境。

### 9.8 重构八：引入治理熔断器和防退化检查

第一阶段需要明确的硬性防线：

- 最大修复迭代次数
- 最大修改范围
- 高风险模块拦截
- 禁止删除测试与断言的静态检查

### 9.9 重构九：给任务执行挂载仓库级只读上下文

除了任务 artifact 之外，执行层还需要拿到一份只读的仓库级背景，例如：

- 目录结构摘要
- 核心模块索引
- 关键类型签名
- 架构约束摘要

这份上下文应该是只读挂载，不参与任务间状态写入。

第一阶段不建议为此引入重型 RAG 基础设施。  
更实际的做法是用静态分析生成一份低成本 Repo Context，例如：

- 仓库目录骨架
- 依赖清单
- 全局函数 / 接口 / 类型签名摘要

它的目标不是替代代码阅读，而是给执行任务提供稳定的全局视角，降低幻觉和重复发明。

### 9.10 重构十：把缺陷发现从“纯扫描”改为“传统信号 + LLM 分诊”

第一阶段的缺陷发现不应主要依赖大模型扫全仓，而应优先消费：

- 测试失败
- lint / typecheck / build 失败
- 文档与代码不一致信号
- 简单规则扫描结果

LLM 主要负责：

- 归因
- 聚合
- 去重
- 分诊
- 生成结构化 `Finding / Issue`

---

## 10. 第一阶段的目标架构是什么样

第一阶段的目标架构建议如下：

```text
Project
  ├─ PipelineDefinition (Documentation)
  ├─ PipelineDefinition (Defect Discovery)
  └─ PipelineDefinition (Defect Repair)

PipelineDefinition
  └─ describes one transaction type

PipelineRun
  └─ owns one execution of a transaction
      └─ expands into many TaskRun

TaskRun
  ├─ parent / child relation
  ├─ dependsOn relation
  ├─ artifact output
  ├─ event stream
  ├─ trace id
  └─ can invoke AgentSession / tooling / verification

Governance Domain
  ├─ RepositoryProfile
  ├─ Finding
  ├─ Issue
  ├─ ChangePlan
  ├─ ChangeUnit
  └─ Verification*

Execution Foundation
  ├─ AgentRunner
  ├─ AgentSession
  ├─ Isolated Workspace (Git Branch)
  ├─ Sandbox Verification Env
  ├─ Read-only Repo Context
  ├─ tool audit & circuit breakers
  └─ runner stream
```

### 10.1 各层职责

#### Project

项目空间，承载：

- 仓库
- 文档
- sessions
- 多条 pipeline

#### PipelineDefinition

定义一种事务流，例如：

- 文档治理
- 缺陷发现
- 缺陷修复

#### PipelineRun

表示一次事务执行。  
它不直接做具体修复，而是负责承载这次事务的全局状态和聚合结果。

#### TaskRun

是第一阶段最重要的新单元。  
它负责：

- 执行某个最小任务
- 独立 claim / lease / retry
- 产出 artifact
- 等待依赖
- 进入挂起 / 恢复
- 透传统一的 trace id 到下层执行

#### Governance Domain

继续承载治理对象本身：

- `Finding`
- `Issue`
- `ChangePlan`
- `ChangeUnit`
- `VerificationResult`

但不再继续承担通用编排。

#### Execution Foundation

继续复用现有基础设施：

- `AgentRunner`
- `AgentSession`
- Session 事件和消息
- 工作区能力
- 工具调用审计

同时补充第一阶段必须新增的执行安全能力：

- Git 分支隔离
- 隔离验证环境
- 只读仓库上下文挂载
- 任务级风险策略与熔断
- PR / 人工审查接入点
- 全链路 trace id 与 prompt 审计能力

### 10.2 第一阶段的目标运行方式

第一阶段跑起来后，预期是这样的：

1. `Documentation Pipeline` 定期或按需运行
2. 它展开若干文档任务，产出文档问题和文档修正 artifact
3. `Defect Discovery Pipeline` 运行，产出 `Finding / Issue`
4. `Defect Repair Pipeline` 只消费允许自动处理的 `Issue`
5. 它展开计划、修复、验证、文档更新任务
6. 整个过程通过 task 级事件、artifact、lease 和挂起机制运行

### 10.3 第一阶段架构边界

第一阶段刻意不把架构一步拉到“完备自治团队”。

第一阶段的边界是：

- 有多条 Pipeline
- Pipeline 内部编排 Task
- 继续复用现有 Session / Runner / Governance 领域模型
- 不做通用长期记忆平台
- 不做新功能开发自治

这是一个“先把维护型自治做稳定”的目标架构。

---

## 11. 第一阶段的总体方案

第一阶段建议采用：

**Project -> 多条 Pipeline -> 每条 Pipeline 运行时展开 Task 树/Task 森林**

### 11.1 为什么是多条 Pipeline

一个项目空间内，不同事务应该由不同 Pipeline 负责。

第一阶段只需要三条：

1. `Documentation Pipeline`
2. `Defect Discovery Pipeline`
3. `Defect Repair Pipeline`

这样做的原因：

- 文档治理、缺陷发现、缺陷修复的触发条件不同
- 它们的输入输出不同
- 它们的自动化风险不同
- 它们的资源占用模式不同

### 11.2 为什么 Pipeline 内部要编排 Task

每条 Pipeline 在一次运行中，不会只执行一个线性流程，而会动态展开多个任务。

例如：

- 文档盘点后，可能拆出多个文档修复任务
- 缺陷发现后，可能拆出多个 triage 任务
- 修复计划后，可能拆出多个执行与验证任务

因此，Pipeline 应升级成“**编排 Task 的事务流**”，而不是“固定 stage 列表”。

### 11.3 第一阶段建议的主模型

建议第一阶段先冻结以下主模型：

- `Project`
- `PipelineDefinition`
- `PipelineRun`
- `TaskRun`
- `TaskArtifact`
- `TaskEvent`

同时建议在模型设计上直接内建两类横切约束：

- `traceId`：用于串联 `PipelineRun -> TaskRun -> AgentSession -> LLM request`
- `artifact schema`：用于保证任务间输入输出契约稳定

其中：

- `PipelineDefinition`：定义一类事务流
- `PipelineRun`：一次事务执行
- `TaskRun`：最小调度单元，可有父子关系和依赖关系
- `TaskArtifact`：任务产物
- `TaskEvent`：任务语义事件

后续如要引入独立 `AgentNode` 能力，可继续往下扩展；但第一阶段不要求一步做到完整 Agent 平台。

---

## 12. 第一阶段的功能范围

### 12.1 Documentation Pipeline

职责：

- 盘点项目现有文档
- 找出缺失、过期、不一致的文档项
- 生成文档修正任务
- 在必要时更新文档

第一阶段建议的任务类型：

- `docs_inventory`
- `docs_gap_analysis`
- `docs_reconcile`

### 12.2 Defect Discovery Pipeline

职责：

- 汇总代码、测试、文档和架构约束的传统信号
- 发现缺陷、风险、债务和不一致
- 生成 `Finding`
- 将 `Finding` 整理成 `Issue`

第一阶段建议的任务类型：

- `repository_profile_refresh`
- `defect_discovery`
- `finding_triage`

### 12.3 Defect Repair Pipeline

职责：

- 消费已确认可自动处理的 `Issue`
- 生成修复计划
- 执行修复
- 验证修复效果
- 更新文档

第一阶段建议的任务类型：

- `fix_plan`
- `fix_execute`
- `fix_verify`
- `docs_update`

---

## 13. 第一阶段的运行策略

### 13.1 只处理维护型任务

第一阶段允许自动处理的任务范围建议限制为：

- 文档缺失或过期
- 已有测试失败
- 代码与文档不一致
- 架构约束违背
- 明确可复现的缺陷
- 明确的小范围治理项

### 13.2 不自动扩展产品功能

第一阶段应明确禁止：

- 新增业务能力
- 扩展 API 范围
- 扩展页面功能
- 修改产品边界

这条约束必须写进治理策略，而不是只靠 prompt 约定。

### 13.3 高风险任务必须挂起

遇到以下情况时，任务应进入挂起态，等待人工确认：

- 会修改高风险核心模块
- 影响面过大
- 会删除大量代码或文档
- 会执行非幂等外部动作
- 验证结果不确定

### 13.4 修复必须带验证和文档同步

第一阶段不接受“只改代码、不验证、不更新文档”的自动化闭环。

一个修复任务要完成，至少要满足：

1. 修复执行成功
2. 对应验证通过
3. 文档更新完成或明确标记无需更新

### 13.5 修复任务必须运行在独立分支和隔离验证环境中

第一阶段至少要做到：

- 每次修复任务有独立分支
- 修改发生在隔离工作区
- `fix_verify` 在隔离环境执行

不满足这三条，不建议开放自动修复。

第一阶段推荐优先使用现有 CI 作为验证执行器，而不是先自建容器调度层。

### 13.6 必须设置熔断与防退化规则

建议第一阶段直接落策略：

- 每个修复任务最多执行固定轮数
- 连续验证失败后自动挂起
- 禁止自动删除现有测试和断言
- 禁止越权修改高风险目录

### 13.7 Discovery 以传统工程信号为主，LLM 为辅

第一阶段 Discovery 的主入口建议优先使用：

- `lint`
- `typecheck`
- `build`
- `test`
- 文档规则检查
- 架构规则检查

LLM 不负责“全仓自由发挥找 bug”，而负责把这些信号整理成更高质量的治理对象。

### 13.8 TaskArtifact 必须是强契约，而不是松散 JSON

`TaskArtifact` 需要被当作任务之间的强类型接口，而不是“给模型随便写的一段 JSON 文本”。

第一阶段建议直接要求：

- 每类 artifact 都有明确 schema
- 入库前必须校验
- 下游消费前必须再次校验
- 校验失败时在当前 task 内阻断并触发 repair，不允许脏数据流向下游

这样才能避免编排层被模型格式幻觉拖垮。

### 13.9 挂起态最终要能对接 PR 审查

第一阶段可以先保留系统内挂起，但设计上需要预留：

- 任务产物映射到 PR 描述
- 人工 review comment 回流为新的任务输入
- PR 合并或驳回作为任务终态信号

### 13.10 必须建立全链路可观测性

第一阶段不要求一步做到完整 tracing 平台，但必须做到：

- 每个 `PipelineRun` 生成全局 `traceId`
- `traceId` 透传到 `TaskRun`
- `traceId` 透传到 `AgentSession`
- `traceId` 透传到 LLM request、工具调用和验证执行

最小目标是：任何失败任务都能回溯出当时的任务输入、关键 artifact、LLM prompt、验证结果和人工介入记录。

---

## 14. 建议复用与新增的部分

### 14.1 可以直接复用的能力

第一阶段建议直接复用：

- `AgentRunner`
- `AgentSession`
- Session message / event / metric / tool use
- workspace 初始化能力
- Governance 的领域对象：`Finding / Issue / ChangePlan / ChangeUnit / Verification*`

这部分不需要推倒重来。

### 14.2 需要新增的能力

第一阶段建议新增：

- `PipelineDefinition`
- `PipelineRun`
- `TaskRun`
- `TaskArtifact`
- `TaskEvent`
- task worker claim / lease / retry / suspend / resume
- task 级父子关系与依赖关系
- task 级资源锁
- Git 分支隔离
- 隔离验证环境
- 仓库级只读上下文挂载
- 熔断与防退化检查
- PR 审查接入点
- artifact schema 校验
- trace id 透传与 prompt 审计

### 14.3 第一阶段不建议新增的能力

第一阶段不建议现在就做：

- 完整的多 Agent 团队协作平台
- 通用 AgentNode 逻辑会话平台
- 跨任务共享长期记忆系统
- 自主规划新功能

这些都应该放到治理闭环跑通之后。

### 14.4 第一阶段不建议自研的能力

第一阶段不建议自研：

- 完整的分布式 DAG 调度引擎
- 复杂的多 worker 心跳接管机制
- 过于泛化的多 Agent 协商框架

如果现有基础设施无法支撑这些能力，一期应优先降级范围，而不是补齐全部底层轮子。

---

## 15. 实施计划

### Step 1：统一编排主模型

先新增并落地：

- `PipelineDefinition`
- `PipelineRun`
- `TaskRun`
- `TaskArtifact`
- `TaskEvent`

目标是把“事务流”和“任务执行”从现有线性 Pipeline / Governance automation 里抽出来。

### Step 2：选择任务基座，并把一期运行时降到最小必要复杂度

优先顺序建议如下：

1. 优先接入成熟任务基座，承接任务状态和重试恢复
2. 如果短期无法接入，则实现一期降级版 task runtime

一期降级版 runtime 只要求：

- task claim
- 明确状态推进
- retry
- suspend / resume
- 有限的父子关系
- 有限并发

不要求一期完成：

- 完整分布式心跳接管
- 高复杂度动态 DAG 调度
- 复杂跨 worker 脑裂恢复

目标是先让治理闭环稳定可跑。

### Step 3：补执行安全基线

在接入自动修复前，先补齐：

- Git 分支隔离
- 隔离验证环境
- 仓库级只读上下文挂载
- 风险策略与熔断规则
- artifact schema 校验
- trace id 透传与 prompt 审计

目标是让后续修复和验证具备最基本的安全边界。

隔离验证环境的优先实现方式建议是：

- 优先复用现有 CI 流水线作为外部验证执行器
- Task 挂起等待 CI 回调
- 暂不把“一期自建容器编排平台”作为前置条件

### Step 4：先接 Documentation Pipeline

优先接文档治理，原因是：

- 风险低
- 任务范围清晰
- 最容易验证闭环

目标是先跑通：

- `docs_inventory -> docs_gap_analysis -> docs_reconcile`

### Step 5：接 Defect Discovery Pipeline

在文档任务跑通后，接入：

- `repository_profile_refresh`
- `defect_discovery`
- `finding_triage`

这一阶段 Discovery 的输入应优先来自传统工程信号，而不是全仓自由扫描。

目标是稳定产出 `Finding` 和 `Issue`。

### Step 6：接 Defect Repair Pipeline

最后接入：

- `fix_plan`
- `fix_execute`
- `fix_verify`
- `docs_update`

目标是打通第一阶段完整治理闭环。

---

## 16. 关键决策建议

为了让评审尽快收敛，建议先确认以下决策：

1. 第一阶段是否同意只做“治理闭环”，不做新功能自治
2. 是否同意一个项目下有多条 Pipeline，各自负责不同事务
3. 是否同意 Pipeline 升级成“编排 Task 的事务流”
4. 是否同意第一阶段先引入 `TaskRun`，而不是直接上完整 AgentNode 平台
5. 是否同意继续复用现有 Governance 领域对象，而不是重建治理领域模型
6. 是否同意高风险任务必须挂起人工确认
7. 是否同意第一阶段不自研完整分布式调度，而优先采用成熟任务基座或降级实现
8. 是否同意自动修复必须建立分支隔离与隔离验证环境
9. 是否同意 Discovery 以传统工程信号为主，LLM 为辅
10. 是否同意一期保留系统挂起，但后续审查流转向 PR 机制收敛

---

## 17. Roadmap

Roadmap 的目的不是一次性承诺所有未来能力，而是明确自治工程系统的演进顺序。

### 17.1 Phase 1：自循环治理闭环

目标：

- 跑通文档梳理、缺陷发现、缺陷修复三条 Pipeline
- 建立 `PipelineRun + TaskRun` 的统一编排主模型
- 让治理闭环具备最小可用的自动运行能力

产出：

- `Documentation Pipeline`
- `Defect Discovery Pipeline`
- `Defect Repair Pipeline`
- Task 级 claim / retry / suspend / resume
- TaskArtifact / TaskEvent
- 分支隔离与隔离验证
- 基于传统工程信号的 Discovery
- 风险熔断与防退化

不做：

- 新功能自治
- 长期记忆平台
- 多 Agent 团队协作框架

### 17.2 Phase 2：测试与验证自治

目标：

- 将测试维护从“修复流程中的附属动作”提升为独立事务
- 形成持续验证、持续回归检测、持续质量守护

建议新增 Pipeline：

- `Test Maintenance Pipeline`
- `Regression Verification Pipeline`

建议新增任务类型：

- `test_gap_analysis`
- `test_generate`
- `test_repair`
- `regression_verify`
- `quality_regression_triage`

完成标志：

- 系统能主动发现测试缺口
- 系统能对修复结果做持续性回归验证

### 17.3 Phase 3：架构与文档持续维护

目标：

- 将架构约束维护和文档维护从“问题驱动”扩展到“持续治理”

建议新增 Pipeline：

- `Architecture Maintenance Pipeline`
- `Documentation Maintenance Pipeline`（从 Phase 1 的文档治理升级为持续维护）

建议新增任务类型：

- `architecture_drift_detect`
- `architecture_rule_enforce`
- `doc_staleness_detect`
- `doc_sync_plan`

完成标志：

- 系统可持续识别架构漂移
- 系统可持续识别文档陈旧和代码文档不一致

### 17.4 Phase 4：独立 Agent 执行层

目标：

- 在 Task 编排稳定后，引入更完整的 Agent 执行抽象

建议新增能力：

- `AgentNodeDefinition`
- `AgentNodeRun`
- `AgentNodeConversation`
- 多 Runner fallback
- 更完整的会话复用与恢复能力

完成标志：

- Task 不再直接临时拼接 Runner 调用
- Agent 执行和 Task 编排职责完全分离

### 17.5 Phase 5：调研与规划自治

目标：

- 在维护型自治稳定后，逐步引入“下一步做什么”的能力

建议新增 Pipeline：

- `Roadmap Research Pipeline`
- `Opportunity Discovery Pipeline`

建议新增任务类型：

- `repository_trend_analysis`
- `feature_candidate_research`
- `roadmap_hypothesis`
- `proposal_review_prep`

完成标志：

- 系统可以基于代码、文档、问题积压和测试信号，提出下一步改进建议
- 仍不直接默认进入功能开发，而是先形成提案与评审输入

### 17.6 Phase 6：特性开发自治

目标：

- 在治理、测试、架构、文档、调研都稳定后，再进入特性开发自治

建议新增 Pipeline：

- `Feature Development Pipeline`

建议新增任务类型：

- `feature_breakdown`
- `spec_generate`
- `implementation_plan`
- `feature_execute`
- `feature_verify`
- `feature_doc_update`

完成标志：

- 系统能够在明确边界内，从需求输入推进到实现、验证与文档同步
- 仍保留高风险任务挂起审批机制

### 17.7 Roadmap 原则

整个 roadmap 建议遵循以下顺序：

1. 先治理，再测试
2. 先维护，再规划
3. 先编排稳定，再抽象 Agent 平台
4. 先低风险自治，再高风险自治
5. 先让系统会“发现和修复已知问题”，再让系统会“决定要做什么新事情”

---

## 18. 结论

当前项目已经具备 Runner、Session、基础 Pipeline 和 Governance 领域模型，问题不在底层执行能力，而在编排模型没有统一。

第一阶段最合理的方向不是直接追求“完备自治开发团队”，而是先把**自循环治理项目**做成一个安全可控的治理闭环：

- 多条 Pipeline
- 每条 Pipeline 编排动态 Task
- 先覆盖文档梳理、缺陷发现、缺陷修复
- 明确禁止新功能扩展
- 不自研完整复杂调度
- 强制分支隔离与隔离验证
- 以传统工程信号驱动 Discovery
- 通过熔断和挂起控制风险

只要这个第一阶段闭环跑通，后续再继续扩展到测试维护、架构维护、特性规划，系统会稳很多；如果第一阶段闭环还没跑通就直接冲“自治开发团队”，风险会非常高。

---

## 附：现状代码落点

当前文档所描述的现状，对应代码主要分布在以下目录：

- Runner：`packages/backend/src/modules/agent-runners`
- Session：`packages/backend/src/modules/sessions`
- Pipeline：`packages/backend/src/modules/pipelines`
- Governance：`packages/backend/src/modules/governance`
- Shared contract：`packages/shared/src/types`、`packages/shared/src/schemas`
- Prisma 模型：`packages/backend/prisma/schema.prisma`
