# Console Ingress

## Summary

The console deployment uses one shared ingress resource.

The ingress owns:

- host routing for the console surface
- HTTP path routing to `console-web`
- HTTP path routing to `console-api`

## Responsibility

- Expose one external host for the operator console.
- Route `/` to the frontend web service.
- Route `/api` to the management API service.

## Interface

- host: `console.localhost`
- path `/`
- path `/api`

## Boundary

- The ingress does not own service deployment.
- The ingress does not own image rollout.
- The ingress does not own application-level routing inside the frontend.
