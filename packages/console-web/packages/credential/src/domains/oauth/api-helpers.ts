import { OAuthAuthorizationPhase } from "@code-code/agent-contract/credential/v1";
import type { ParsedOAuthCallbackInput } from "./api-types";

const oauthSessionsPath = "/api/oauth/sessions";

export function buildOAuthSessionEventsPath(sessionId: string) {
  return `${oauthSessionsPath}/${encodeURIComponent(sessionId)}/events`;
}

export function isTerminalOAuthPhase(phase: OAuthAuthorizationPhase) {
  return phase === OAuthAuthorizationPhase.SUCCEEDED
    || phase === OAuthAuthorizationPhase.FAILED
    || phase === OAuthAuthorizationPhase.EXPIRED
    || phase === OAuthAuthorizationPhase.CANCELED;
}

export function parseOAuthCallbackInput(input: string): ParsedOAuthCallbackInput {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("Callback URL is required.");
  }
  let candidate = trimmed;
  if (!candidate.includes("://")) {
    if (candidate.startsWith("?")) {
      candidate = `http://localhost${candidate}`;
    } else if (/[/?#]/.test(candidate) || candidate.includes(":")) {
      candidate = `http://${candidate}`;
    } else if (candidate.includes("=")) {
      candidate = `http://localhost/?${candidate}`;
    } else {
      throw new Error("Invalid callback URL.");
    }
  }

  const parsedURL = new URL(candidate);
  const query = parsedURL.searchParams;
  let code = query.get("code")?.trim() || "";
  let state = query.get("state")?.trim() || "";
  let error = query.get("error")?.trim() || "";
  let errorDescription = query.get("error_description")?.trim() || "";

  const hash = parsedURL.hash.startsWith("#") ? parsedURL.hash.slice(1) : parsedURL.hash;
  if (hash) {
    const hashQuery = new URLSearchParams(hash);
    if (!code) {
      code = hashQuery.get("code")?.trim() || "";
    }
    if (!state) {
      state = hashQuery.get("state")?.trim() || "";
    }
    if (!error) {
      error = hashQuery.get("error")?.trim() || "";
    }
    if (!errorDescription) {
      errorDescription = hashQuery.get("error_description")?.trim() || "";
    }
  }

  if (code && !state && code.includes("#")) {
    const [resolvedCode, resolvedState] = code.split("#", 2);
    code = resolvedCode.trim();
    state = resolvedState.trim();
  }

  if (!error && errorDescription) {
    error = errorDescription;
    errorDescription = "";
  }

  if (!code && !error) {
    throw new Error("Callback URL missing code.");
  }

  return {
    code,
    state,
    error,
    errorDescription,
  };
}
