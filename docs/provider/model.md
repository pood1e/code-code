# LLM Provider Model

## responsibility

`provider` owns model-provider access contracts, not agent runtime identity.

Provider access is modeled as:

- `ProviderSurface`: stable provider surface capability.
- `ProviderAccount`: tenant-owned provider account.
- access target: account-local callable API/CLI/Web path.
- `ProviderRunBinding`: frozen provider/model/auth/access binding for one run.

Model choice is owned by profile, session, or run request. A provider account
does not own a default model.

## boundary

Provider owns account identity, selected surface, credential grant reference,
source reference, account-level provider model catalog, and callable access
targets.

Provider does not own credential secret material, canonical model truth, agent
runtime image selection, user/session default model selection, provider-card
metadata, or vendor presentation assets.

## legacy endpoint projection

`ProviderSurfaceBinding`-shaped contracts are legacy runtime materialization details.
They may remain behind internal runtime boundaries while execution collapses
onto account plus access target.

New public contracts, UI models, and docs should not introduce endpoint CRUD,
endpoint-local defaults, or endpoint-owned model-selection behavior.
