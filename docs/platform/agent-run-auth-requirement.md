## responsibility

`AgentRunAuthRequirement` is the session/run domain view of provider auth.

It carries only provider-visible routing/auth status:

- `provider_id`
- `provider_surface_binding_id`
- `auth_status`
- `runtime_url`
- `materialization_key`

`platform-agent-runtime-service` owns per-run prepare orchestration and passes this non-secret auth bootstrap metadata to the CLI runtime image.

Envoy auth processor resolves real credential material at request time.

## implementation notes

`platform-agent-runtime-service` freezes `AgentRunAuthRequirement` into the action/run snapshot.

`AgentRun` dynamic workflow runs prepare jobs before the agent container starts.

Workflow and session code must not carry tokens, cookies, API keys, or long-lived credential material.
