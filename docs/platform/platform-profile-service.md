# Platform Profile Service

## responsibility

`platform-profile-service` owns Postgres-backed `AgentProfile` management operations and profile validation.
It also owns profile-scoped MCP server, skill, and rule management.

## external methods

- `platform.profile.v1.ProfileService/ListAgentProfiles`
- `platform.profile.v1.ProfileService/GetAgentProfile`
- `platform.profile.v1.ProfileService/CreateAgentProfile`
- `platform.profile.v1.ProfileService/UpdateAgentProfile`
- `platform.profile.v1.ProfileService/DeleteAgentProfile`
- `platform.profile.v1.ProfileService/*MCPServer`
- `platform.profile.v1.ProfileService/*Skill`
- `platform.profile.v1.ProfileService/*Rule`

## implementation notes

- The service stores profile truth in `platform_profiles`.
- The service stores MCP server, skill, and rule truth in `platform_mcp_servers`, `platform_skills`, and `platform_rules`.
- `console-api` calls this service directly for profile-domain management.
- Agent runtime calls this service over gRPC for profile-backed session projection.
- Profile validation reads profile-owned MCP servers, skills, and rules from Postgres-backed stores.
- Provider, endpoint, CLI definition, and CLI specialization validation goes through `platform-provider-service` gRPC.
- `GetAgentProfile` returns profile generation so session projection can freeze the effective config provenance.
