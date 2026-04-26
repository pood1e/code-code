# AgentProfile

## responsibility

- own platform profile CRUD mainline
- own management-facing `AgentProfileListItem` projection
- own `AgentProfile` selection validation and session-submit resolution input
- own detach of deleted MCP / skill / rule ids from stored profiles

## key fields

- `profile_id`
- `name`
- `selection_strategy.provider_id`
- `selection_strategy.execution_class`
- `selection_strategy.fallbacks[]`
- `mcp_ids[]`
- `skill_ids[]`
- `rule_ids[]`

## key methods

- `agentprofiles.Service.List(ctx)`
- `agentprofiles.Service.Get(ctx, profileID)`
- `agentprofiles.Service.GetState(ctx, profileID)`
- `agentprofiles.Service.Create(ctx, profile)`
- `agentprofiles.Service.Update(ctx, profileID, profile)`
- `agentprofiles.Service.Delete(ctx, profileID)`
- `agentprofiles.Service.DetachMCP/DetachSkill/DetachRule(ctx, id)`
- `agentprofiles.ProviderReferences`
- `agentprofiles.ResourceReferences`

## implementation

- domain proto path uses `platform/agent_profile/v1/agent_profile.proto`
- profile truth is stored in Postgres table `platform_profiles`
- stored row `id` must equal `profile_id`
- row `generation` is the profile generation returned to session submit paths
- `platform-profile-service` exposes profile CRUD through `platform.profile.v1.ProfileService`
- create / update validates:
  - `name`
  - enabled provider id
  - `selection_strategy.execution_class` against latest available CLI runtime images
  - ordered fallback candidate shape
  - duplicate refs
  - referenced MCP / skill / rule existence through dedicated readers
- `selection_strategy.fallbacks[]` stores ordered provider/model policy, not `ResolvedProviderModel`
- `mcp_ids[]`、`skill_ids[]`、`rule_ids[]` store stable ids only; session submit resolves them into `AgentSessionSpec.ResourceConfig`
- `AgentProfileListItem.selection_summary` and reference counts are projected from stored profile payloads; they are not independent truth
