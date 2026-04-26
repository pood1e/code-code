import { describe, expect, it } from "vitest";
import type { ProviderSurfaceBindingView } from "@code-code/agent-contract/platform/management/v1";
import { getProviderModelCount, providerModelsSummary } from "./provider-model-summary";

describe("provider-model-summary", () => {
  it("counts surface model entries from the surface catalog", () => {
    const instance = {
      runtime: {
        catalog: {
          models: [{ providerModelId: "gpt-4.1" }, { providerModelId: "gpt-4.1-mini" }, { providerModelId: "o4-mini" }],
        },
      },
    } as ProviderSurfaceBindingView;

    expect(getProviderModelCount(instance)).toBe(3);
    expect(providerModelsSummary(instance)).toBe("3 models");
  });

  it("shows empty copy when no surface models are configured", () => {
    const instance = {
      runtime: {
        catalog: {
          models: [],
        },
      },
    } as ProviderSurfaceBindingView;

    expect(getProviderModelCount(instance)).toBe(0);
    expect(providerModelsSummary(instance)).toBe("No models configured");
  });
});
