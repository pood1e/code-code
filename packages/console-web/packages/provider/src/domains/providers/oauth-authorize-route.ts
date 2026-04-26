const oauthAuthorizePath = "/provider-credentials/oauth/authorize";
const authorizationUrlParam = "authorizationUrl";

export function buildOAuthAuthorizeRoute(authorizationURL: string) {
  const trimmed = authorizationURL.trim();
  const params = new URLSearchParams();
  params.set(authorizationUrlParam, trimmed);
  return `${oauthAuthorizePath}?${params.toString()}`;
}

export function readOAuthAuthorizeTarget(searchParams: URLSearchParams) {
  return searchParams.get(authorizationUrlParam)?.trim() || "";
}
