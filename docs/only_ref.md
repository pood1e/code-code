# only_ref Directory

`only_ref/` 是一个 reference-only 目录，保存旧的实现代码供理解历史行为使用。

## 规则

来自 [only_ref/AGENTS.md](../only_ref/AGENTS.md)：

- 只用来理解过去的行为或提取边界情况。
- 实现新功能前必须从零抽象重新设计，不得直接复用旧抽象。
- 不得将此目录视为 source of truth。
- 不得将此目录的代码直接复制回 mainline。
- 不得复活此目录中的代码到 mainline path。

## 内容

- `only_ref/packages/backend/` — 旧 backend 实现。
- `only_ref/services/runner-svc/` — 旧 runner service 实现。
- `only_ref/scripts/` — 旧工具脚本。
- `only_ref/worktree_snapshot/` — 工作树快照。

---

此目录不参与编译、测试或部署。
