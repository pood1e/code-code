# Backend Aggregate Mainline

## responsibility

- define one backend mainline for platform-owned domain packages
- keep transport adapters thin and move domain behavior into aggregates
- keep Kubernetes resource persistence behind repository abstractions

## mainline

- `transport` only decodes requests, encodes responses, and maps errors
- `service` only orchestrates aggregates, repositories, and cross-owner collaboration
- `aggregate` owns validation, normalization, identifiers, invariants, projection, and resource mapping
- `repository` owns Kubernetes load/list/create/update/delete mechanics

## package shape

- owner packages use `model.go`, `repository.go`, `service.go`, and optional projector files
- generated proto and CRD structs stay as boundary DTOs and do not own business behavior
- shared persistence helpers live under `packages/platform-k8s/internal/resourceowner`

## implementation

- config-only CRUD packages follow one aggregate + one typed repository path
- workflow packages keep planning and state transition logic in aggregates, not in service helpers
- replaced normalize or mapping helpers are removed in the same change
