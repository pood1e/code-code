# AgentRun Passive Observability

## responsibility

- `agent-session` owns passive response-header metric collection for AgentRun.
- The egress Wasm plugin forwards matched response headers plus runtime source.
- `agent-session` resolves pod/run metadata, then applies `header_metric_policy_id`.
- Support service only provides the opaque policy id.

## key fields

- projected Secret `provider_id`
- projected Secret `cli_id`
- projected Secret `header_metric_policy_id`
- projected Secret `response_header_metric_rules[]`
- projected Secret target host/path selectors

## implementation notes

- Concrete header metric rules live in `header_metric_policies.yaml` under
  agent runtime/session code.
- `platform-auth-service` does not own passive metric rules.
- Runtime rules are frozen into the projected Secret as a snapshot, not as the
  declaration source of truth.
- Agent-session records OTel metrics after both L4 target host and L7 path
  selectors match.
- vendor passive metrics 不走 active probe，也不主动发 inference request。
