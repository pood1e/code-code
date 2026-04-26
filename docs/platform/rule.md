# Rule

这份文档定义 `Rule` 的平台抽象。

## 职责

`Rule` 负责表达：

- 一个稳定的 rule 标识
- 一个 operator-facing 名称
- 一个简短描述
- 一段完整约束文本

## Rule

- `RuleID`
  作用：标识一个稳定 rule。
- `Name`
  作用：operator-facing rule display name。
- `Description`
  作用：列表与选择场景使用的短描述。
- `Content`
  作用：resolve 到 `AgentResources.instructions` 的完整文本。

## 存储

- truth is stored in Postgres table `platform_rules`

## 方法

- `rules.Store`
- `rules.NewRepository(pool)`
- `rules.Service.List/Get/Create/Update/Delete`
