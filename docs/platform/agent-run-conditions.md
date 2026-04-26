# AgentRun Conditions

这份文档定义 `AgentRunCondition` 的稳定 vocabulary。

这套 vocabulary 参考 Kubernetes condition 约定：

- `Type` 使用稳定语义名
- `Reason` 使用简短 `CamelCase` 类别名
- `Message` 保存面向人的细节说明

参考：

- Pod lifecycle conditions: https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/
- CustomResourceDefinition status conditions: https://kubernetes.io/zh-cn/docs/reference/kubernetes-api/extend-resources/custom-resource-definition-v1/

## Type

`Type` 取值：

- `Accepted`
  作用：control plane 已接受这次 run 的 desired state。
- `ProviderResolved`
  作用：provider/model binding 已完成解析。
- `WorkloadReady`
  作用：backing workload 已创建并进入可执行状态。
- `Completed`
  作用：run 已到达 terminal result。

规则：

- `Type` 是稳定 API vocabulary。
- 同一个 `AgentRunStatus` 中，同一种 `Type` 只能出现一次。
- `Type` 必须和允许的 `Reason` 集合匹配。

## Reason

`Reason` 表示 condition 最近一次状态变化的稳定类别。

`Reason` 取值：

- `Accepted`
- `InvalidSpec`
- `ProviderResolved`
- `ProviderResolutionFailed`
- `WorkloadCreated`
- `WorkloadCreateFailed`
- `RunStarted`
- `RunSucceeded`
- `RunFailed`
- `RunCanceled`

规则：

- `Reason` 必须是非空 `CamelCase`。
- `Reason` 用于程序化归类与 concise 输出。
- `Message` 用于保存面向人的详细说明。
- `ObservedGeneration` 不能超过所属 `AgentRunStatus.ObservedGeneration`。

## Type 与 Reason 的对应关系

- `Accepted`
  常见 `Reason`：`Accepted`、`InvalidSpec`
- `ProviderResolved`
  常见 `Reason`：`ProviderResolved`、`ProviderResolutionFailed`
- `WorkloadReady`
  常见 `Reason`：`WorkloadCreated`、`WorkloadCreateFailed`、`RunStarted`
- `Completed`
  常见 `Reason`：`RunSucceeded`、`RunFailed`、`RunCanceled`
