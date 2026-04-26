import { OAuthAuthorizationFlow } from "@code-code/agent-contract/credential/v1";
import { openExternalUrl } from "@code-code/console-web-ui";

const missingAuthorizationURLMessage = "Authorization URL is missing.";

export function openOAuthAuthorizationUrl(url: string | null | undefined): void {
  openExternalUrl((url || "").trim());
}

export function openOAuthAuthorizationUrlForFlow(
  url: string | null | undefined,
  flow?: OAuthAuthorizationFlow,
): void {
  const normalized = (url || "").trim();
  if (!normalized) {
    if (flow === OAuthAuthorizationFlow.CODE) {
      throw new Error(missingAuthorizationURLMessage);
    }
    return;
  }
  openExternalUrl(normalized);
}
