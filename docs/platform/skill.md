# Skill

这份文档定义 `Skill` 的平台抽象。

## 职责

`Skill` 负责表达：

- 一个稳定的 skill 标识
- 一个 operator-facing 名称
- 一个简短描述
- 一段完整 instruction 文本

## Skill

- `SkillID`
  作用：标识一个稳定 skill。
- `Name`
  作用：operator-facing skill display name。
- `Description`
  作用：列表与选择场景使用的短描述。
- `Content`
  作用：resolve 到 `AgentResources.instructions` 的完整文本。

## 存储

- truth is stored in Postgres table `platform_skills`

## 方法

- `skills.Store`
- `skills.NewRepository(pool)`
- `skills.Service.List/Get/Create/Update/Delete`
