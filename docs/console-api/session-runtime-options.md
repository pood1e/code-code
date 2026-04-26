# Session Runtime Options

## Responsibility

- `platform-chat-service` exposes session setup runtime selector data through the chat-owned facade.
- `console-api` exposes it as browser JSON at `/api/chats/session-runtime-options`.
- The contract aggregates CLI identity, execution class, provider account/access
  target, and model options.

## External Surface

- Browser: `GET /api/chats/session-runtime-options`
- Internal: `platform.chat.v1.ChatService.GetSessionRuntimeOptions`

## Implementation Notes

- `providerId` uses CLI identity.
- `items[]` is keyed by CLI specialization.
- `executionClasses[]` comes from latest available CLI runtime images and is constrained by CLI definitions.
- target options are scoped to provider accounts supported by the selected CLI.
- `models[]` comes from provider catalog and does not imply a provider-owned
  default model.
