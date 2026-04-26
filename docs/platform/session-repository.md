# Session Repository

## responsibility

`packages/session` owns session desired setup, observed status, and user-visible turn transcript persistence.

`chat` owns chat metadata such as `display_name` and the one-to-one `chat_id -> session_id` binding. Chat creates and updates session setup by injecting a session repository.

`agent-session` runtime code owns control-plane actions: turn submission, warm-state reset, active-run control, and reconcile triggers. It does not own the session data landing.

Session setup includes future-turn prepare jobs. The repository stores the
common job envelope and opaque CLI-owned `parameters_yaml`; execution freezes it
into `AgentRun.prepare_jobs`.

## key methods

- `Repository.Get(ctx, session_id)`
- `Repository.Create(ctx, spec)`
- `Repository.Update(ctx, session_id, spec)`
- `Repository.UpdateStatus(ctx, session_id, status)`
- `TurnMessageRepository.UpsertTurnMessage(ctx, message)`
- `TurnMessageRepository.ListTurnMessages(ctx, session_id, page_size)`

## implementation notes

Postgres storage uses `platform_sessions` for session snapshots, `platform_session_turn_messages` for final AG-UI-compatible transcript messages, and `platform_domain_outbox` for session domain events.

Desired setup updates increment session generation. Status updates preserve generation, check `status.observed_generation` when present, and emit `status_updated`.

Temporal workflows are durable orchestration adapters behind control-plane services. Temporal does not store platform business truth.

Turn transcript records store final message projections only. Runtime deltas stay in the run event stream; durable chat history is rebuilt by listing messages for the bound session.

Delayed controller requeues are coalesced by owner/action and handled by the runtime service scheduler path, not in service memory.
