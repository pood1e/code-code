# Model Registry Resolution

## Responsibility

`ModelRegistry` owns canonical `ModelDefinition` lookup and resolution.
`LLMProvider` owns provider-callable model ids.

provider catalog 与 canonical registry 是两层不同 identity：

- canonical identity: `ModelDefinition.model_id`
- provider identity: `ProviderModelCatalogEntry.provider_model_id`
- binding edge: `ProviderModelCatalogEntry.model_ref`

## Key Types

### ModelRegistry

Methods:

- `Get(ref)`
  Purpose: return one canonical `ModelDefinition` by canonical `ModelRef`.
- `Resolve(ref, override)`
  Purpose: return one `ResolvedModel` from a canonical `ModelRef` and an optional provider-scoped override.
- `ResolveRef(modelIDOrAlias)`
  Purpose: return the canonical `ModelRef` for one canonical id or alias string.

## Resolution Rules

- `ModelRegistry` 只存 canonical `ModelDefinition`
- provider-callable ids 不进入 `ModelRegistry`
- `ModelRegistry` 通过 `platform.model.v1.ModelService/ListModelDefinitions` 查询 model-service registry truth
- provider connect / status validation 只消费 `model_ref`
- exact canonical `ModelDefinition.model_id` match wins
- if no canonical id matches, exact alias match is used
- multiple matches are invalid
- missing matches are invalid
- malformed resources 不进入 resolution 结果
- provider catalog materialization must not create default `ModelDefinition` resources

## Boundaries

- `ResolvedProviderModel.model_id` 是最终调用 provider 时使用的 provider-callable id
- `ResolvedProviderModel.model.model_id` 是 canonical model id
- provider catalog metadata 可以补充 latency、availability、limits，但不能改写 canonical model facts
