## responsibility

`service-http-triggers` exposes internal HTTP endpoints for manual operations,
debugging, and service-owned event triggers.

## fields

- `POST /internal/actions/{action}` triggers one registered service action.
- Request body is optional JSON and is passed to the action.
- Response is JSON with `action`, `status`, and optional `result`.

## implementation

Services keep long-running work in their own background task registry or
Temporal worker. Periodic production execution is owned by Temporal Schedules;
HTTP triggers remain a thin ingress path for explicit service actions.
