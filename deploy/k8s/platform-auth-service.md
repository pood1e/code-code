# Platform Auth Service Kubernetes Base

## Responsibility

这组 manifests 负责把 `platform-auth-service` 作为 auth action 与 OAuth session 运行面部署到 Kubernetes。

## Objects

- `ServiceAccount`
- `Role`
- `RoleBinding`
- `Deployment`
- `Service`

## Access Scope

`platform-auth-service` 是 auth-backed `CredentialDefinition`、`OAuthAuthorizationSession`、credential Secret 和 runtime credential projection 的写入面。

- `credentialdefinitions`
- `oauthauthorizationsessions`
- `secrets`
- `configmaps`

Vendor and CLI reference data are read from static support registries, not from
Kubernetes resources.

runtime namespace：

- `secrets`

## Runtime Settings

- `PLATFORM_AUTH_SERVICE_GRPC_ADDR=:8081`
- `PLATFORM_AUTH_SERVICE_HTTP_ADDR=:8080`
- `PLATFORM_AUTH_SERVICE_NAMESPACE` 从 Pod namespace 注入
- `PLATFORM_AUTH_SERVICE_OAUTH_CALLBACK_BASE_URL` 指定 hosted OAuth callback base URL

## Scheduled Scans

`oauth-maintenance` is registered by `platform-auth-service` as a Temporal
Schedule. It runs every minute on the `platform-auth-service` task queue and
executes auth-owned activities for due refresh and session scanning. The auth
domain decides whether each item is due.
