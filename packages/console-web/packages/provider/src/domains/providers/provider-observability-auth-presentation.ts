export type ProviderObservabilityAuthField = {
  key: string;
  label: string;
  placeholder: string;
  description?: string;
  defaultValue?: string;
  required?: boolean;
  sensitive?: boolean;
  multiline?: boolean;
};

export type ProviderObservabilityAuthPresentation = {
  dialogTitle: string;
  providerActionLabel: string;
  description: string;
  fieldLabel: string;
  guideHref?: string;
  guideLabel?: string;
  placeholder: string;
  schemaId: string;
  requiredKeys: string[];
  fields: ProviderObservabilityAuthField[];
  separateProviderUpdate: boolean;
};

const cerebrasCodeMonitorGuideURL = "https://github.com/nathabonfim59/cerebras-code-monitor";

function singleFieldPresentation(config: {
  dialogTitle: string;
  providerActionLabel: string;
  description: string;
  schemaId: string;
  key: string;
  label: string;
  placeholder: string;
  guideHref?: string;
  guideLabel?: string;
  separateProviderUpdate?: boolean;
}): ProviderObservabilityAuthPresentation {
  return {
    dialogTitle: config.dialogTitle,
    providerActionLabel: config.providerActionLabel,
    description: config.description,
    fieldLabel: config.label,
    guideHref: config.guideHref,
    guideLabel: config.guideLabel,
    placeholder: config.placeholder,
    schemaId: config.schemaId,
    requiredKeys: [config.key],
    fields: [{
      key: config.key,
      label: config.label,
      placeholder: config.placeholder,
      required: true,
      sensitive: true,
    }],
    separateProviderUpdate: Boolean(config.separateProviderUpdate),
  };
}

const cerebrasPresentation = singleFieldPresentation({
  dialogTitle: "Update authjs.session-token",
  providerActionLabel: "Update authjs.session-token…",
  description: "Paste the cookie value used by Cerebras Cloud active quota query.",
  schemaId: "cerebras-session",
  key: "authjs_session_token",
  label: "authjs.session-token",
  placeholder: "Paste authjs.session-token",
  guideHref: cerebrasCodeMonitorGuideURL,
  guideLabel: "Guide",
  separateProviderUpdate: true,
});

const openrouterPresentation = singleFieldPresentation({
  dialogTitle: "Update OpenRouter Session",
  providerActionLabel: "Update Session…",
  description: "Paste the cookie value used by OpenRouter active quota query.",
  schemaId: "openrouter-session",
  key: "session_token",
  label: "Cookie",
  placeholder: "__Secure-next-auth.session-token=...",
  separateProviderUpdate: true,
});

const googleAIStudioPresentation: ProviderObservabilityAuthPresentation = {
  dialogTitle: "Update AI Studio Session",
  providerActionLabel: "Update AI Studio Session…",
  description: "Paste AI Studio browser session fields and the quota project number from ListModelRateLimits.",
  fieldLabel: "Cookie",
  placeholder: "Paste AI Studio session cookies",
  schemaId: "google-ai-studio-session",
  requiredKeys: ["cookie", "page_api_key", "project_id"],
  fields: [
    {
      key: "cookie",
      label: "Request Cookie",
      placeholder: "SID=...; HSID=...; SSID=...; SAPISID=...; __Secure-1PAPISID=...",
      description: "Copy the Cookie request header from ListModelRateLimits.",
      required: true,
      sensitive: true,
      multiline: true,
    },
    {
      key: "response_set_cookie",
      label: "Response Set-Cookie",
      placeholder: "Paste one or more Set-Cookie response headers, one per line.",
      description: "Optional. Paste Set-Cookie response headers from the same request; they will be merged into Request Cookie before saving.",
      multiline: true,
    },
    {
      key: "authorization",
      label: "Request Authorization",
      placeholder: "SAPISIDHASH ...",
      description: "Optional. Copy the Authorization request header from the same ListModelRateLimits request. Leave blank to let the service derive it from Cookie.",
      sensitive: true,
    },
    {
      key: "page_api_key",
      label: "X-Goog-Api-Key",
      placeholder: "AIzaSy...",
      required: true,
    },
    {
      key: "project_id",
      label: "Project number",
      placeholder: "946397203396 or projects/946397203396",
      description: "Use the projects/<number> value from the ListModelRateLimits request body. gen-lang-client-* is accepted as a fallback client project id.",
      required: true,
    },
  ],
  separateProviderUpdate: true,
};

export function providerObservabilityAuthPresentation(vendorId?: string | null): ProviderObservabilityAuthPresentation | null {
  switch ((vendorId || "").trim().toLowerCase()) {
    case "cerebras":
      return cerebrasPresentation;
    case "google":
      return googleAIStudioPresentation;
    case "openrouter":
      return openrouterPresentation;
    default:
      return null;
  }
}
