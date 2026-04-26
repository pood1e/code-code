# Provider Endpoint Projection

## responsibility

Provider endpoint projection is an internal compatibility boundary for runtime
paths that still need endpoint-shaped payloads.

It should not be used for new public provider APIs, console flows, or model
selection behavior.

## rules

- source of truth remains the provider account aggregate
- endpoint projection must be derived, not independently owned
- endpoint projection does not read credential Secret material
- endpoint projection does not own default model selection
- catalog validation does not trigger remote model discovery

## removal path

Collapse runtime callers onto provider account plus access target. After that,
delete endpoint-shaped proto messages, CRUD adapters, and projection helpers.
