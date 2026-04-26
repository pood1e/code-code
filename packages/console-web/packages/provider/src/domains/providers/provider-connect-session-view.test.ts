import { create } from "@bufbuild/protobuf";
import {
  ProviderConnectSessionPhase,
  ProviderConnectSessionViewSchema,
  ProviderViewSchema,
} from "@code-code/agent-contract/platform/management/v1";
import { describe, expect, it } from "vitest";
import { isProviderConnectSessionPollingComplete } from "./provider-connect-session-view";

describe("isProviderConnectSessionPollingComplete", () => {
  it("keeps polling succeeded sessions until the provider is available", () => {
    const session = create(ProviderConnectSessionViewSchema, {
      phase: ProviderConnectSessionPhase.SUCCEEDED,
    });

    expect(isProviderConnectSessionPollingComplete(session)).toBe(false);
  });

  it("stops polling succeeded sessions with a provider", () => {
    const session = create(ProviderConnectSessionViewSchema, {
      phase: ProviderConnectSessionPhase.SUCCEEDED,
      provider: create(ProviderViewSchema, {
        providerId: "codex-cli-552ae9",
      }),
    });

    expect(isProviderConnectSessionPollingComplete(session)).toBe(true);
  });

  it("stops polling failed terminal sessions", () => {
    const session = create(ProviderConnectSessionViewSchema, {
      phase: ProviderConnectSessionPhase.FAILED,
    });

    expect(isProviderConnectSessionPollingComplete(session)).toBe(true);
  });

  it("keeps polling non-terminal sessions", () => {
    const session = create(ProviderConnectSessionViewSchema, {
      phase: ProviderConnectSessionPhase.PROCESSING,
    });

    expect(isProviderConnectSessionPollingComplete(session)).toBe(false);
  });
});
