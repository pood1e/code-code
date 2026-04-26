import type { OAuthAuthorizationFlow } from "@code-code/agent-contract/credential/v1";

export type OAuthCLIId = string;

export type StartOAuthSessionDraft = {
  cliId: OAuthCLIId;
  flow: OAuthAuthorizationFlow;
  targetCredentialId: string;
  targetDisplayName: string;
};

export type ParsedOAuthCallbackInput = {
  code: string;
  state: string;
  error: string;
  errorDescription: string;
};
