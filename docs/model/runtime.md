# Model Runtime

这份文档定义默认 `ModelDefinition` 的查询与合并 contract。

## 模型图

```text
ModelRegistry
  -> ModelRef
  -> ModelDefinition
  -> ModelOverride
  -> ResolvedModel
```

## ModelRegistry

表示默认 model 注册表。

方法：

- `Get(ref)`
  作用：按 `ModelRef` 返回默认 `ModelDefinition`。
- `Resolve(ref, override)`
  作用：基于默认 `ModelDefinition` 与可选 `ModelOverride` 生成最终 `ResolvedModel`；`ModelOverride` 的覆盖范围由 `FieldMask` 显式声明。

## 规则

- `Resolve` 必须先加载默认 `ModelDefinition`。
- 当 `override` 存在时，只应用 `FieldMask` 指定的字段。
- 当 `override` 不存在时，直接返回默认 `ModelDefinition` 对应的 `ResolvedModel`。
- platform 负责把 `ModelRegistry` 注入需要解析 `AvailableModel` 的 provider runtime。
