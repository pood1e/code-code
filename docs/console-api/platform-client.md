# Platform Client

## Responsibility

`internal/platformclient` 负责把 console 所需的 upstream gRPC surface 适配成内部 client。
`console-api` 直接调用 browser 所需的 domain gRPC services；model registry 和 vendor reference reads 通过 Connect proxy 暴露。

## Upstreams

- `platform-chat-service`
  - `platform.management.v1.AgentSessionManagementService` for session read and turn/run control
  - `platform.chat.v1.ChatService`
- `platform-agent-runtime-service` (only behind `platform-chat-service`)
  - `platform.management.v1.AgentSessionManagementService`
  - `AgentSession`
  - `AgentSessionAction`
  - `AgentRun`
- `platform-provider-service`
  - `platform.provider.v1.ProviderService`
- `platform-profile-service`
  - `platform.profile.v1.ProfileService`
- `platform-egress-service`
  - `platform.egress.v1.EgressService`
- `platform-auth-service`
  - `platform.oauth.v1.OAuthSessionService`
  - `platform.oauth.v1.OAuthCallbackService`

## External Methods

- `AgentProfiles()`
- `MCPServers()`
- `Skills()`
- `Rules()`
- `Providers()`
- `Templates()`
- `CLIDefinitions()`
- `VendorCapabilityPackages()`
- `CLISpecializationPackages()`
- `AgentSessions()`
- `AgentSessionActions()`
- `AgentRuns()`
- `OAuthSessions()`
- `AgentSessionManagementClient()`
- `ChatServiceClient()`

## Implementation Notes

- profile-domain surface 固定走 `platform-profile-service`。
- model registry read surface 走 `/api/connect/platform.model.v1.ModelService/ListModelDefinitions`。
- vendor reference read surface 走 `/api/connect/platform.provider.v1.ProviderService/ListVendors`。
- provider-domain surface 固定走 `platform-provider-service`。
- egress surface 固定走 `platform-egress-service`。
- OAuth session/callback surface 固定走 `platform-auth-service`。
- chat session setup/runtime-options surface 通过 `ChatServiceClient()` 走 `platform.chat.v1.ChatService`。
- session read and turn/run control surface 通过 `AgentSessions()`、`AgentSessionActions()`、`AgentRuns()` 走 `AgentSessionManagementService`。
- `platform-chat-service` 再通过 gRPC 调用 `platform-agent-runtime-service`。
- `AgentSessions()` 不创建或更新 session setup；setup 由 `ChatService` 通过共享 session repository 写入。
- upstream 失联时，对应路由按路由级 `Unavailable` 返回。
