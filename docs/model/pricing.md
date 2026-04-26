# Model Pricing

这份文档定义 `model` 价格元数据 contract。

## ModelPricing

表示一个 model 的价格元数据。

字段：

- `InputPrice`
  作用：每百万 input tokens 的价格。
- `CachePricings`
  作用：不同 cache policy 的写入/读取价格集合。
- `OutputPrice`
  作用：每百万 output tokens 的价格。
- `BatchInputPrice`
  作用：每百万 batch input tokens 的价格。
- `BatchOutputPrice`
  作用：每百万 batch output tokens 的价格。
- `ToolPrices`
  作用：按工具调用计费的价格集合。
- `Source`
  作用：标识价格来自 provider API、官方价格页或手工配置。
- `LongContextPricing`
  作用：长上下文场景下的价格倍率规则。

## 规则

- 价格元数据允许缺省。
- `MoneyAmount.nanos` 的有效范围是 `-999_999_999` 到 `999_999_999`，并且必须与 `units` 保持符号一致。
- `MoneyAmount` 负责表达绝对价格，`LongContextPricing` 的 bps 字段负责表达倍率；两者职责不同，不混写同一含义。
- OpenAI 的完整价格通常来自官方价格页或官方模型文档，不是 `List Models API`。
- Anthropic 的价格和部分模型元数据可从官方 models/pricing 文档同步。
