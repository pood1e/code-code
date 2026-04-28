# Platform Ingress

## Summary

The platform uses one shared Istio-managed Gateway API `Gateway` for
operator-facing HTTP ingress.

The gateway owns:

- one external NodePort-backed HTTP listener
- namespace admission for application `HTTPRoute` resources through the
  `ingress.platform.code-code.internal/platform-ingress=enabled` namespace
  label
- Istio telemetry for inbound traffic at the platform edge

Application charts own their own `HTTPRoute` resources:

- console routes `/` to `console-web` and `/api` to `console-api`
- showcase routes `/` to `showcase-web` and `/api` to `showcase-api`
- Grafana routes `/` to `grafana`
- Kiali routes `/` to `kiali`

## Namespace Groups

| Namespace | Group | Ingress ownership |
|-----------|-------|-------------------|
| `code-code-net` | `edge` | shared `platform-ingress` Gateway and gateway Service |
| `code-code` | `platform` | internal control-plane services |
| `code-code-console` | `console` | console workloads and route |
| `code-code-showcase` | `showcase` | showcase workloads and route |
| `code-code-observability` | `observability` | Grafana and Kiali routes |
| `code-code-infra` | `infrastructure` | internal infra only, not attached to external Gateway |
| `code-code-runs` | `runtime` | agent-run workloads only, not attached to external Gateway |

## Responsibility

- Expose operator and observability hosts through `code-code-net/platform-ingress`.
- Keep ingress traffic on official Istio Gateway API resources.
- Route host/path traffic to the service that owns the HTTP surface.

## Interface

- gateway namespace: `code-code-net`
- gateway name: `platform-ingress`
- gateway listener: `http`, port `80`
- local NodePort: `30599`
- console primary URL: `http://console.192.168.0.126.nip.io:30599`
- showcase primary URL: `http://showcase.192.168.0.126.nip.io:30599`
- Grafana primary URL: `http://grafana.192.168.0.126.nip.io:30599`
- Kiali primary URL: `http://kiali.192.168.0.126.nip.io:30599`

## Boundary

- `istio-platform` owns the shared `Gateway` and generated gateway service
  customization.
- `cluster-bootstrap` owns namespace traffic-group labels and the namespace
  label that admits `HTTPRoute` resources to `platform-ingress`.
- `istio-platform` owns the ingress gateway egress `NetworkPolicy`, including
  selected backend pods, backend service ports, and Ambient HBONE port `15008`
  for ambient-enrolled backend namespaces.
- `platform` owns the console/showcase deployments, services, and `HTTPRoute`
  resources in their dedicated ingress namespaces.
- `platform` owns first-party inbound `AuthorizationPolicy` baselines for
  platform, console, showcase, and egress service workloads.
- `infrastructure-addons` owns the Grafana and Kiali `HTTPRoute` resources.
- The gateway does not own service deployment, image rollout, or
  application-level routing inside each HTTP backend.

## Analyzer Hygiene

- Platform-owned mesh namespaces use `istio.io/dataplane-mode=ambient`.
- Non-mesh system namespaces should be explicitly labeled
  `istio-injection=disabled` so `istioctl analyze` does not report ambiguous
  injection state.
- Platform-owned Kubernetes Service port names should follow Istio's
  `<protocol>[-suffix]` convention, for example `http`, `tcp-postgres`, or
  `udp-cluster`.
- `make -C deploy smoke-ingress` keeps the analyzer baseline scoped to
  platform-owned namespaces. Third-party chart namespaces stay visible through
  cluster-wide `istioctl analyze -A` but are not allowed to block the platform
  ingress smoke path.

## Cutover

- The local `30599` NodePort must be owned by `platform-ingress-istio`.
- If `ingress-nginx-controller` still owns `80:30599`, uninstall or move that
  service before installing the Istio ingress gateway on `30599`.
- For side-by-side testing, temporarily override
  `components.ingressGateway.httpNodePort` to an unused NodePort and use that
  port in the local public URLs.
