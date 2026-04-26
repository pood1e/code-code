import { describe, expect, it } from "vitest";
import { OAuthAuthorizationPhase } from "@code-code/agent-contract/credential/v1";
import {
  buildOAuthSessionEventsPath,
  isTerminalOAuthPhase,
  parseOAuthCallbackInput,
} from "./api";

describe("oauth api helpers", () => {
  it("builds the session events path", () => {
    expect(buildOAuthSessionEventsPath("session-1")).toBe("/api/oauth/sessions/session-1/events");
  });

  it("parses callback URL query fields", () => {
    expect(parseOAuthCallbackInput("http://127.0.0.1:1455/auth/callback?code=abc&state=s1")).toEqual({
      code: "abc",
      state: "s1",
      error: "",
      errorDescription: "",
    });
  });

  it("parses callback fields from fragment", () => {
    expect(parseOAuthCallbackInput("http://127.0.0.1:1455/auth/callback#code=abc&state=s1")).toEqual({
      code: "abc",
      state: "s1",
      error: "",
      errorDescription: "",
    });
  });

  it("recognizes terminal OAuth phases", () => {
    expect(isTerminalOAuthPhase(OAuthAuthorizationPhase.SUCCEEDED)).toBe(true);
    expect(isTerminalOAuthPhase(OAuthAuthorizationPhase.FAILED)).toBe(true);
    expect(isTerminalOAuthPhase(OAuthAuthorizationPhase.PROCESSING)).toBe(false);
  });
});
