# Roadmap

围绕 Agent 容器隔离与存储两条主线的演进计划。背景是 Agent 容器会执行 LLM 生成的代码，需要按"不可信代码执行"威胁模型加固。

---

## 现状

| 维度 | 实现 | 不足 |
|------|------|------|
| 计算隔离 | 普通容器 + capabilities drop + seccomp + non-root | 共享宿主内核，kernel CVE 可逃逸 |
| 网络隔离 | Istio Ambient + Egress Gateway，默认 Deny | 已达标 |
| 存储 | 每 Session 独立 PVC（workspace + home-state） | 节点 attach 上限、容量线性增长、空闲也占盘 |
| 出口策略 | 声明式 ServiceEntry / VirtualService | 已达标 |

---

## Phase 1：上 Kata Containers（计算隔离 → VM 级）

**动机**：跑不可信代码，普通容器隔离不够。Kata 提供独立 kernel 的 VM 级隔离，且对现有架构零侵入。

**改造点**：
- 节点池增加 KVM 支持
- 新增 `RuntimeClass: kata`
- AgentRun Job spec 加上 `runtimeClassName: kata`
- 验证现有 sidecar、PVC、Istio Ambient 在 Kata 下行为一致

**不变的部分**：CRD、Controller、Temporal Workflow、Istio、可观测性栈全部沿用。

**风险**：
- 冷启动从 ~100ms 增加到 1~3s（场景下可接受）
- 部分 host syscall 直通行为变化，需验证 CLI 工具

**完成判据**：
- 所有 AgentRun 默认走 Kata RuntimeClass
- 容器逃逸渗透测试覆盖通过

---

## Phase 2：JuiceFS 替换 PVC（存储弹性）

**动机**：PVC 模式在节点 attach 上限、容量、成本三方面都不可扩展。JuiceFS 在已有 PostgreSQL + 对象存储基础上增量极小，POSIX 兼容、CSI driver 现成、跨节点 RWX。

**改造点**：
- 部署 JuiceFS CSI driver
- 元数据引擎复用 PostgreSQL（或独立 Redis）
- 数据后端使用现有对象存储
- workspace / home-state PVC 改用 JuiceFS StorageClass
- 业务代码 0 改动

**风险**：
- 小文件性能（CLI 工具 `~/.cache` 大量小文件）需基准测试
- 元数据集群成为新的 SPOF，需要 HA

**完成判据**：
- 单节点 attach 上限不再是瓶颈
- 存储成本随实际使用量计费，空 Session 接近 0 成本

---

## Phase 3：Session Hibernate（成本优化）

**动机**：长尾空闲 Session 占着存储但无活动。Gitpod / Codespaces 的标准做法是冻结到对象存储。

**改造点**：
- AgentSession Controller 增加空闲超时（如 30 分钟无 Action）
- 触发 hibernate Workflow：打包 home-state → 上传对象存储 → 释放 JuiceFS 目录
- 下次 Action 进来 → resume Workflow：从对象存储拉回 → 重建挂载 → 启动 Run
- Session 状态新增 `HIBERNATED` phase

**风险**：
- 冷启动延迟 +5~10s，需评估是否影响首条消息体验
- 并发 resume 需要去重（Temporal Workflow ID 已天然支持）

**完成判据**：
- 空闲 Session 存储占用降至接近 0
- Resume 成功率 > 99.9%，p95 延迟 < 10s

---

## 明确不做

- **Firecracker microVM 自研编排**：E2B 模式适合公网 SaaS + 海量短生命周期 sandbox + sub-second 冷启动。当前是内部平台，规模小一到两个量级，K8s 投资沉重，不值得推倒重来。如未来转为对外 SaaS 再评估。
- **gVisor**：用户态内核兼容性差，CLI 工具行为不稳，且隔离强度低于 VM。Kata 已覆盖该需求。
- **ReadWriteMany NFS / EFS / CephFS**：单点性能瓶颈、权限隔离弱，规模上不去。JuiceFS 已是更好选择。
- **状态完全结构化外置**：CLI Agent 的 `~/.config`、`~/.local` 不可结构化，强行拆解收益小、改造成本高。

---

## 优先级与依赖

```
Phase 1 (Kata)        独立，立即可做
   │
   ├─ Phase 2 (JuiceFS)   依赖：对象存储已就绪
   │     │
   │     └─ Phase 3 (Hibernate)   依赖：Phase 2 完成
```

Phase 1 是安全基线，Phase 2/3 是规模化基线。Phase 1 与 Phase 2 可并行启动。
