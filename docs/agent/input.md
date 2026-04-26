# Agent Input Contract

这份文档定义 agent provider 的 input contract。

## 模型图

```text
AgentDescriptor
  -> InputSchema

RunRequest
  -> RunInput
  -> Text
  -> Parameters
```

## InputSchema

表示 provider-facing extension parameters 的 schema。

字段：

- `Format`
  作用：标识 schema language。
- `Schema`
  作用：承载 machine-readable schema document。
- `JsonSchemaDialect`
  作用：标识当前 JSON Schema 使用的 dialect URI。

## InputSchemaFormat

表示 schema language。

枚举值：

- `JsonSchema`
  作用：使用 JSON Schema 表达参数结构、校验约束和展示元信息。

规则：

- 当前 v1 只支持 `JsonSchema`。
- `JsonSchemaDialect` 必须显式提供。
- `Schema` 本身必须是可编译的有效 JSON Schema。

## RunInput

表示平台解析后的 provider-facing input。

字段：

- `Text`
  作用：承载通用文本输入。
- `Parameters`
  作用：承载本次 run 的扩展参数对象，必须匹配 provider 声明的 `InputSchema`。

规则：

- `RunInput.Parameters` 必须通过对应 `InputSchema` 的 JSON Schema 校验。
- `Parameters` 为空时按空 object 参与校验。

## JSON Schema Usage

`Schema` 使用 JSON Schema object。

关键能力：

- `type`
  作用：定义参数或字段类型。
- `properties`
  作用：定义参数对象字段结构。
- `required`
  作用：定义必填字段。
- `enum`
  作用：定义可选值集合。
- `minimum` / `maximum`
  作用：定义 number 范围。
- `minLength` / `maxLength`
  作用：定义 string 长度范围。
- `items`
  作用：定义 array 元素结构。
- `default`
  作用：定义默认值。
- `title`
  作用：定义字段展示标题。
- `description`
  作用：定义字段说明。
