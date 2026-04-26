responsibility
- own provider account, provider endpoint, and owner observability behavior inside `provider`
- keep pages, dialogs, and cards limited to orchestration, mutation, and rendering

key methods
- `providerAccountModel(account)`
- `providerSurfaceBindingModel(endpoint)`
- `providerOwnerObservabilityModel(item, providerSurfaceBindingId)`
- `resolveProviderOwnerObservabilityModel(detail, owner, providerSurfaceBindingId)`

implementation notes
- account model owns display name, primary endpoint selection, auth kind and label, OAuth summary, model and endpoint summaries, and status derivation
- endpoint model owns endpoint display name, endpoint detail, model summary, and endpoint status presentation
- owner observability model owns metric row lookup, metric value lookup, observed-at label, and provider endpoint scoped filtering
- concrete quota readers compose the generic models and keep only provider-specific metric mapping
