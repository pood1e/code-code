# Console Web Model

## Summary

`console-web` 是 `console-api` 的前端呈现层，首版目标是提供一个可运行、可扩展的 Console 页面骨架。

设计实现必须遵循仓库根 `AGENTS.md` 中的 `console-web` UI 规则。

模型由两个 abstraction 组成：

- `Shell App`
- `UI System`

## Shell App

### Responsibility

- 组装页面结构与导航状态。
- 持有页面级状态（active section、sidebar collapsed）。

### Ownership

- 拥有页面级状态。
- 不拥有业务实体真相，不持有 provider/credential 等 domain 数据模型。

### Interface

- `bootstrap(config)`：启动应用并挂载到 DOM。
- `config`：路由与侧边栏初始化配置。

### Failure Behavior

- 当窗口状态计算失败时，页面保持可用，导航与侧边栏行为仍可恢复。

## UI System

### Responsibility

- 提供可复用的 layout primitives 与 visual primitives。
- 基于 package-distributed component system（Radix Themes primitives）实现结构组件。
- 提供统一 design tokens，确保视觉一致性与主题可演进性。

### Key Types

- `NavItem`：定义 sidebar 项目的 key、label。
- `ConsoleShellLayoutProps`：约束 shell 布局插槽与交互回调。

### Boundary

- `UI System` 不发起网络请求。
- `UI System` 不依赖业务 domain 包。

### Reuse Rule

- 全局通用组件放到 `packages/console-web/packages/ui`。
- 语义一致组件在代码库中重复达到 2 处或以上时，必须抽取为复用组件。
- 内容模型（例如 nav items、section metadata）也按同样规则执行，不允许并行维护多份同语义 key 集合。
- 文案提示只用于语义复杂且可能产生歧义的场景；语义直观的项默认只保留标签。

## Data Flow

`Shell App` 在组装完成后将状态与回调下发到 `UI System`，由其渲染统一的操作布局与页面槽位。

## Extension Points

- `Shell App` 可注册更多 section，并复用同一套 layout primitives。
