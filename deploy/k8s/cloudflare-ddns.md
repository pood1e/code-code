# Cloudflare DDNS

## responsibility

`cloudflare-ddns` updates Cloudflare DNS records for origin webhook hostnames.

It does not replace ingress. In the current webhook path, the home router still forwards `8443` to `ingress-nginx`.

## apply

Set the rollout config through environment variables:

```bash
export CLOUDFLARE_DDNS_DOMAINS='bot.pood1e.monster'
export CLOUDFLARE_DDNS_PROXIED='false'
export CLOUDFLARE_DDNS_IP4_PROVIDER='cloudflare.trace'
export CLOUDFLARE_DDNS_IP6_PROVIDER='none'
export CLOUDFLARE_DDNS_UPDATE_CRON='@every 5m'
export CLOUDFLARE_DDNS_UPDATE_ON_START='true'
```

Create the Cloudflare token Secret:

```bash
kubectl -n code-code-infra create secret generic cloudflare-ddns-token \
  --from-literal=CLOUDFLARE_API_TOKEN='<cloudflare-api-token>'
```

Deploy through the infrastructure chart after the Secret exists:

```bash
DEPLOY_CLOUDFLARE_DDNS=1 \
CLOUDFLARE_DDNS_DOMAINS='bot.pood1e.monster' \
CLOUDFLARE_DDNS_PROXIED='false' \
deploy/release.sh deploy
```

The Cloudflare token must stay in the Secret only. Do not commit it.

Token permissions:

- `Zone:Zone:Read`
- `Zone:DNS:Edit`
- resource scope includes `pood1e.monster`

## test

```bash
kubectl -n code-code-infra logs deploy/cloudflare-ddns --tail=80
dig +short bot.pood1e.monster
```

DDNS only updates DNS. If the router has no real public IP or cannot forward `8443` to this host, use Cloudflare Tunnel instead.

The chart renders `ConfigMap/cloudflare-ddns-config` from those environment variables. Before enabling it on a new node, verify that public IP detection returns the home broadband IP.
