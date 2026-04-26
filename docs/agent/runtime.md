# Agent Runtime Contract

这份文档定义 platform 驱动 `agent provider` 的 Go behavior contract。

## 主链

```text
AgentProvider
  -> AgentRuntime
  -> Run
```

## 职责

`AgentProvider` 负责：

- 暴露 provider descriptor
- 基于运行环境创建 runtime

`AgentRuntime` 负责：

- 应用 platform 下发的 resources snapshot
- 暴露 runtime health 状态
- 启动一次 run
- 释放 runtime 资源

`Run` 负责：

- 暴露 ordered output stream
- 返回最终 result
- 响应停止请求

## AgentProvider

方法：

- `Descriptor()`
  作用：返回 provider descriptor 和 capability 声明。
- `NewRuntime(env)`
  作用：基于运行环境创建 runtime。

## AgentRuntime

方法：

- `ApplyResources(ctx, resources)`
  作用：应用 platform 下发的 resource snapshot，从后续 `StartRun` 生效。
- `HealthCheck(ctx)`
  作用：探测 runtime 是否仍可接受工作。
- `StartRun(ctx, request)`
  作用：启动一次 run。
- `Close(ctx)`
  作用：释放 runtime 持有的资源。

## Run

方法：

- `Outputs()`
  作用：返回 ordered output stream；stream error 通过 terminal `RunEvent.Error` 传递。
- `Wait(ctx)`
  作用：等待 run 完成并返回最终 result。
- `Stop(ctx)`
  作用：请求停止 run。

## Type Aliases

`agent` package 暴露常用 contract type aliases：

- `AgentDescriptor`
  作用：引用 `core/v1.AgentDescriptor`。
- `RuntimeEnvironment`
  作用：引用 `core/v1.RuntimeEnvironment`。
  说明：表示 runtime workload 内部可见的路径，不表示平台宿主机路径。
- `RunRequest`
  作用：引用 `core/v1.RunRequest`。
- `LLMProviderFilter`
  作用：引用 `policy/v1.LLMProviderFilter`。
- `AgentResources`
  作用：引用 `cap/v1.AgentResources`。
- `RunOutput`
  作用：引用 `output/v1.RunOutput`。
- `RunError`
  作用：引用 `result/v1.RunError`。
- `RunEvent`
  作用：Go runtime stream item，承载 `RunOutput` 或 terminal `RunError`。
- `RunResult`
  作用：引用 `result/v1.RunResult`。
