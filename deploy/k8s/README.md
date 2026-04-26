# Kubernetes Deployment

## responsibility

Kubernetes manifests for the control plane, workflows, console, Istio egress, and observability stack.

## main order

1. Namespaces and infrastructure.
2. CRDs and workflow runtime.
3. Workflow templates and runtime RBAC.
4. Domain services: `platform-auth-service`, `platform-model-service`, `platform-provider-service`, `platform-network-service`, `platform-profile-service`, `platform-cli-runtime-service`.
5. Session, chat, console API, and console web.

## notes

Provider-owned workflows use `platform-provider-service/runtime-rbac`.
CLI image build submission uses `platform-cli-runtime-service/runtime-rbac`.
