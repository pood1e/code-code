# Cloudflare DDNS

## responsibility

Cloudflare DDNS keeps webhook host DNS records pointed at the current public IP.

The updater owns only Cloudflare DNS record reconciliation. It does not expose services, terminate TLS, or route webhook requests.

Ingress owns inbound HTTP routing after Cloudflare reaches the local network.

## external fields

ConfigMap `cloudflare-ddns-config`:

- `DOMAINS`: comma-separated webhook FQDNs
- `PROXIED`: Cloudflare proxy fallback
- `IP4_PROVIDER`: IPv4 detector, default `cloudflare.trace`
- `IP6_PROVIDER`: IPv6 provider, default `none`
- `UPDATE_CRON`: update schedule

Secret `cloudflare-ddns-token`:

- `CLOUDFLARE_API_TOKEN`

The Cloudflare API token needs Zone Read and DNS Edit permissions scoped to the target zone.

## implementation notes

Kubernetes resources live under `deploy/k8s/cloudflare-ddns/base`.

Runtime:

1. `cloudflare-ddns` detects the current public IPv4 address.
2. It updates Cloudflare `A` records for `DOMAINS`.
3. Cloudflare forwards HTTP(S) webhook traffic to the local public IP.
4. Router or host forwarding sends 80/443 to `ingress-nginx`.
5. Kubernetes `Ingress` routes the webhook path to the receiver service.

The deployment runs a single replica in `code-code-infra`, clears proxy environment variables, and must run only on a node whose public IP detection returns the home broadband IP.

DDNS requires a real reachable public IP plus 80/443 forwarding. If the network is behind CGNAT, use Cloudflare Tunnel instead.

References:

- https://github.com/favonia/cloudflare-ddns
- https://github.com/favonia/cloudflare-ddns/releases/tag/1.16.2
- https://developers.cloudflare.com/fundamentals/api/get-started/create-token/
