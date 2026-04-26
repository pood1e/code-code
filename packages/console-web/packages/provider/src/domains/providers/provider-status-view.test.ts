import { describe, expect, it } from "vitest";
import { ProviderSurfaceBindingPhase } from "@code-code/agent-contract/platform/management/v1";
import { providerStatusReason } from "./provider-status-view";

describe("provider-status-view", () => {
  it("hides ready reason", () => {
    expect(
      providerStatusReason(
        ProviderSurfaceBindingPhase.READY,
        "Provider surface configuration is valid.",
      ),
    ).toBe("");
  });

  it("preserves non-ready reason", () => {
    expect(
      providerStatusReason(
        ProviderSurfaceBindingPhase.INVALID_CONFIG,
        "backing secret missing",
      ),
    ).toBe("backing secret missing");
  });
});
