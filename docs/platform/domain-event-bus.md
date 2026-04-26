# Domain Event Bus

## responsibility

- persist platform state mutations in Postgres with one outbox row per mutation
- publish protobuf `platform.domain_event.v1.DomainEvent` messages to NATS JetStream
- drive stateless service reconciliation from durable pull consumers

## external fields

- stream: `PLATFORM_DOMAIN_EVENTS`
- subjects: `platform.domain.<aggregate>.<event_type>`
- content type: `application/x-protobuf`
- idempotency key: `event_id`

## implementation

- Explicit owner repositories write state rows and outbox events in the same
  transaction; no Kubernetes client facade redirects CRUD into Postgres.
- `domainevents.Outbox` is written in the same transaction as the state row.
- `domainevents.Publisher` publishes pending outbox rows with JetStream message de-duplication.
- `domainevents.Consumer` stores processed `event_id` values before invoking handlers.
- agent runtime consumes `agent_session` and `agent_session_action` events.
- auth service consumes `oauth_session` and `credential` events.
