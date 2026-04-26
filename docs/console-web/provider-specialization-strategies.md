responsibility
- register provider account card renderers and model source labels inside `console-web`
- centralize provider protocol, catalog, and authentication presentation rules inside `provider`
- keep generic UI assembly unaware of concrete `cli`, `vendor`, `source`, and protocol definition ids

key fields or methods
- `registerProviderAccountCardRenderer(binding)`
- `resolveProviderAccountCardRenderer(owner)`
- `registerSourceFilterOption(option)`
- `buildSourceOptions()`
- `registerProviderProtocolPresentation(item)`
- `protocolLabelFor(protocol)`
- `providerCatalogSourceLabelValue(source)`
- `providerSurfaceBindingAuthenticationLabel(kind)`

implementation notes
- each concrete `cli` or `vendor` owns its own registration file
- each concrete model source owns its own registration file
- each concrete custom provider protocol owns its own registration file
- `vendor:google` quota card renderer owns `gen_ai.provider.quota.limit` row aggregation and tier label normalization
- generic presentation modules own enum-to-label rules that are shared across views
- generic registry files only resolve from registered entries
