import { lazy } from "react";

const ProvidersPage = lazy(() =>
  import("./pages/providers").then((m) => ({ default: m.ProvidersPage }))
);

const ModelsPage = lazy(() =>
  import("./pages/models").then((m) => ({ default: m.ModelsPage }))
);
const OAuthCallbackPage = lazy(() =>
  import("./domains/providers/components/oauth-callback-page").then((m) => ({ default: m.OAuthCallbackPageRoute }))
);
const OAuthAuthorizePage = lazy(() =>
  import("./domains/providers/components/oauth-authorize-page").then((m) => ({ default: m.OAuthAuthorizePageRoute }))
);

export const LLM_PROVIDER_ROUTES = [
  { path: "providers", element: <ProvidersPage /> },
  { path: "provider-credentials/oauth/authorize", element: <OAuthAuthorizePage /> },
  { path: "provider-credentials/oauth/callback", element: <OAuthCallbackPage /> },
  { path: "models", element: <ModelsPage /> }
];
