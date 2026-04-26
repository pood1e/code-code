# Agent Session Adapter

## Responsibility

`internal/agentsessions` owns console-side AgentSession control adapters.

## Methods

- `ManagementClient.CreateTurn/ResetWarmState`

## Implementation Notes

- The package does not know `Chat`, AG-UI, browser routes, or session storage.
- `ManagementClient` adapts `platform.management.v1.AgentSessionManagementService` for turn control only.
- session defaulting and repository code lives in `packages/session`.
- Chat, workflow, and future external entrypoints reuse `packages/session` for setup/state and this adapter for control calls.
