# CLI Code Assist Adapter

## responsibility

`packages/platform-k8s/internal/supportservice/clidefinitions/codeassist` owns Google Code Assist HTTP request construction and response parsing shared by auth credential import and provider observability.

## key methods

- `LoadGeminiCodeAssist`
- `LoadGeminiUserQuota`
- `LoadAntigravityCodeAssist`
- `OnboardAntigravityUser`

## implementation notes

Callers provide `http.Client` and access token. The adapter does not read Kubernetes Secrets, persist credential data, or emit metrics.
