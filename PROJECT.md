# 项目说明

内部 AI Agent 运行平台，核心能力是将用户请求调度到隔离的安全容器中执行，支持多 Agent 并发运行。

---

## 整体架构

### 分层视图

```
┌─────────────────────────────────────────────────────────────────────┐
│  浏览器                                                             │
│   console-web  (React + SWR + ConnectRPC)                           │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ HTTP / REST JSON
┌──────────────────────────────▼──────────────────────────────────────┐
│  BFF                                                                │
│   console-api  (Go，路由聚合、错误映射、SSE 转发)                   │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ gRPC / ConnectRPC
┌──────────────────────────────▼──────────────────────────────────────┐
│  platform-k8s 微服务群（控制平面，code-code-platform 命名空间）     │
│                                                                     │
│  auth-service     provider-service    model-service                 │
│  profile-service  chat-service        agent-runtime-service         │
│  network-service  cli-runtime-service support-service               │
│  notification-dispatcher  wecom-callback-adapter                    │
└──┬────────────┬───────────┬─────────────┬─────────────┬─────────────┘
   │            │           │             │             │
   │ 读写       │ 提交      │ 创建/Watch  │ 发布/订阅   │ 导出 traces
   ▼            ▼           ▼             ▼             ▼
┌────────┐ ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐
│Postgres│ │Temporal │ │ K8s API  │ │   NATS   │ │ OTel Collect │
│        │ │ Cluster │ │          │ │JetStream │ │              │
│ 域状态 │ │Workflow │ │ CRD +    │ │事件流总线│ │ ↓            │
│ 持久化 │ │  编排   │ │  Job     │ │          │ │Prometheus +  │
│        │ │         │ │          │ │          │ │  Grafana     │
└────────┘ └────┬────┘ └────┬─────┘ └────▲─────┘ └──────────────┘
                │           │            │
                │ Activity  │ 创建 Job   │ 写入 RunOutput
                │           ▼            │
                │   ┌──────────────────────────────────────┐
                │   │  code-code-runs 命名空间             │
                │   │  （Agent 容器执行隔离区）            │
                │   │                                      │
                │   │  ┌────────────┐  ┌─────────────┐    │
                │   │  │  execute   │  │ cli-output  │────┘
                │   │  │  容器      │──│ sidecar     │
                │   │  │ Agent 主体 │  │ 输出采集    │
                │   │  └─────┬──────┘  └─────────────┘
                │   │        │ 挂载
                │   │   PVC: workspace / home-state
                │   └──┬───────────────────────────────────┘
                │      │ 出站 LLM 调用
                │      ▼
                │   ┌──────────────────────────────────────┐
                │   │  Istio Ambient + Egress Gateway      │
                │   │  （声明式出口策略，默认 Deny）       │
                │   └──┬───────────────────────────────────┘
                │      │
                │      ▼
                │   ┌──────────────────────────────────────┐
                │   │  外部 LLM Providers                  │
                │   │  Anthropic / OpenAI / Google / ...   │
                │   └──────────────────────────────────────┘
                │
                └─→ Workflow 通过 Activity 调用 agent-runtime-service
                    （创建 Job、轮询状态、清理资源）

CRD 资源（K8s API 中持久化）：
  AgentSessionResource          会话期望状态 + Profile 快照
  AgentRunResource              单次执行（对应一个 K8s Job）
  AgentSessionActionResource    会话内 Turn 队列
  CredentialDefinitionResource  凭证定义 + Secret 引用
  OAuthAuthorizationSessionResource  OAuth 授权会话
```

### 关键流向

- **状态读写**：微服务 ↔ PostgreSQL（域状态）+ K8s API（资源 CRD）
- **执行编排**：agent-runtime-service → Temporal Workflow → K8s Job
- **输出回流**：execute 容器 → cli-output sidecar → NATS → chat-service → console-web
- **出站隔离**：Agent 容器 → Istio Egress Gateway → 外部 Provider
- **可观测性**：所有服务 → OTel → Prometheus + Grafana

---

## 核心概念

| 概念 | 说明 |
|------|------|
| **AgentProfile** | 用户配置的 Agent 模板（Provider、模型、规则） |
| **AgentSession** | 运行时会话，持有 Profile 快照、PVC 存储、运行状态 |
| **AgentRun** | 单次执行（对应一个 Turn），以 K8s Job 形式运行 |
| **Provider** | LLM 服务提供方（API / CLI / Web 三种类型） |
| **Credential** | Provider 凭证（API Key / OAuth / Session） |

**主链**：用户提交消息 → agent-runtime-service 通过 Temporal 编排 → 创建 K8s Job → Agent 容器执行 → cli-output sidecar 采集输出写入 NATS → chat-service 流式返回前端。

---

## Agent 安全容器

每个 AgentRun 对应一个 K8s Job，Pod 内含两个容器：

- **execute 容器**：Agent 主体，执行用户请求，挂载 workspace PVC（可读写）
- **cli-output sidecar**：采集 execute 的标准输出，写入 NATS JetStream，只读文件系统

**安全隔离措施**：

| 维度 | 机制 |
|------|------|
| 进程权限 | `runAsUser: 1000`，`runAsNonRoot: true`，`allowPrivilegeEscalation: false` |
| 能力限制 | `capabilities.drop: [ALL]`，无任何 Linux Capability |
| 文件系统 | sidecar 只读根文件系统；execute 容器写权限限制在挂载 PVC |
| 存储隔离 | 每个 Session 独立 PVC（workspace + home-state），`ReadWriteOnce` |
| 网络隔离 | `code-code-runs` 命名空间默认 Deny Egress；对外流量必须经过 Istio Egress Gateway |
| Syscall 限制 | `seccompProfile: RuntimeDefault` |
| 认证隔离 | 每个 Run 持有独立冻结的 `AuthRequirement`（MaterializationKey），不跨 Run 共享 |
| 执行不重试 | `BackoffLimit: 0`，`RestartPolicy: Never`，失败即止 |

---

## 多 Agent 并发

**同一 Session 内**：串行执行。Active Run Slot 机制保证同一 Session 同时只有 1 个 Active Run，Turn 按顺序排队。

**跨 Session**：完全并发，无全局限制，受集群 ResourceQuota 约束。不同 Session 的容器存储（PVC）和认证材料完全隔离。

**调度流程**：

```
用户提交 Turn
  → Claim Active Run Slot（Postgres 原子操作）
  → 创建 AgentRunResource (K8s CRD)
  → Controller 调用 Temporal Workflow
  → Workflow 编排：Prepare Jobs → Execute Job → Cleanup
  → K8s Job 创建 → Pod 运行 → 结果写入 NATS
  → Run 完成 → Release Active Run Slot
```

**Run 生命周期**：`PENDING → SCHEDULED → RUNNING → SUCCEEDED | FAILED | CANCELED`

---

## 技术选型

- **后端**：Go，Kubernetes CRD + controller-runtime，gRPC / ConnectRPC，Temporal（Workflow 编排），NATS JetStream（输出事件流），PostgreSQL
- **前端**：React 19 + TypeScript，SWR，Radix Themes，ConnectRPC
- **合约**：跨语言模型在 `packages/proto` 定义，生成 Go 和 TypeScript 类型
- **网格**：Istio Ambient（Service Mesh + Egress Gateway，声明式出口策略）

---

## 包结构

| 包 | 职责 |
|----|------|
| `packages/platform-k8s` | CRD 定义、控制器、所有后端微服务、Agent Job 调度 |
| `packages/console-api` | BFF，前端请求转发到后端 gRPC 服务 |
| `packages/console-web` | 前端控制台（按域分包） |
| `packages/proto` | 跨语言 Protobuf 合约（规范模型定义） |
| `packages/go-contract` / `agent-contract` | Proto 生成的 Go / TS 类型导出 |
