import { create, fromJson, toJson, type JsonValue } from "@bufbuild/protobuf";
import { OAuthAuthorizationSessionStateSchema } from "@code-code/agent-contract/credential/v1";
import type { OAuthCallbackDelivery } from "@code-code/agent-contract/platform/support/v1";
import { StartOAuthAuthorizationSessionRequestSchema } from "@code-code/agent-contract/platform/oauth/v1";
import { jsonRequest, protobufJsonReadOptions } from "@code-code/console-web-ui";

import { type StartOAuthSessionDraft } from "./api-types";
import { parseOAuthCallbackInput } from "./api-helpers";

const oauthSessionsPath = "/api/oauth/sessions";

export async function startOAuthSession(input: StartOAuthSessionDraft) {
  const request = create(StartOAuthAuthorizationSessionRequestSchema, input);
  const data = await jsonRequest<JsonValue>(oauthSessionsPath, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(toJson(StartOAuthAuthorizationSessionRequestSchema, request)),
  });
  return fromJson(OAuthAuthorizationSessionStateSchema, data, protobufJsonReadOptions);
}

export async function getOAuthSession(sessionId: string) {
  const data = await jsonRequest<JsonValue>(`${oauthSessionsPath}/${encodeURIComponent(sessionId)}`);
  return fromJson(OAuthAuthorizationSessionStateSchema, data, protobufJsonReadOptions);
}

export async function cancelOAuthSession(sessionId: string) {
  const data = await jsonRequest<JsonValue>(`${oauthSessionsPath}/${encodeURIComponent(sessionId)}`, {
    method: "DELETE",
  });
  return fromJson(OAuthAuthorizationSessionStateSchema, data, protobufJsonReadOptions);
}

export async function submitOAuthCodeCallback(
  sessionId: string,
  callbackDelivery?: Pick<OAuthCallbackDelivery, "callbackProviderId" | "providerRedirectUri">,
  callbackInput?: string
) {
  const trimmedSessionID = sessionId.trim();
  if (!trimmedSessionID) {
    throw new Error("OAuth session id is required.");
  }
  const providerId = callbackDelivery?.callbackProviderId.trim() || "";
  if (!providerId) {
    throw new Error("OAuth callback provider id is missing.");
  }
  const providerRedirectUri = callbackDelivery?.providerRedirectUri.trim() || "";
  if (!providerRedirectUri) {
    throw new Error("OAuth callback provider redirect URI is missing.");
  }
  const parsed = parseOAuthCallbackInput(callbackInput || "");
  const response = await jsonRequest<JsonValue>(
    `${oauthSessionsPath}/${encodeURIComponent(trimmedSessionID)}/callback`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        providerId,
        providerRedirectUri,
        code: parsed.code,
        state: parsed.state,
        error: parsed.error,
        errorDescription: parsed.errorDescription,
      }),
    }
  );
  return fromJson(OAuthAuthorizationSessionStateSchema, response, protobufJsonReadOptions);
}
