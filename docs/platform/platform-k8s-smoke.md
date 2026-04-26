# Platform K8s Smoke

## responsibility

- verify first-party platform services start without CRD installs
- verify Postgres-backed state and NATS domain events are reachable
- verify provider templates write through provider service instead of `kubectl apply`

## implementation

- deploy infrastructure, auth service, provider service, model service, and agent runtime service
- confirm all first-party service roles avoid domain-state CRD permissions
- apply quick templates through provider service API
- verify provider state in `platform_providers`
- verify domain events in `PLATFORM_DOMAIN_EVENTS`
