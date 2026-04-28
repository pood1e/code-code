import { describe, expect, it } from "vitest";
import type { ProviderSurfaceRuntime } from "@code-code/agent-contract/provider/v1";
import { ProviderSurfaceBindingPhase, type ProviderView, type ProviderSurfaceBindingView } from "@code-code/agent-contract/platform/management/v1";
import { ProviderProtocol, type ProviderProtocolValue } from "./provider-protocol";
import { providerModel } from "./provider-model";
import { providerSurfaceBindingModel } from "./provider-surface-binding-model";

describe("provider-model", () => {
  it("derives surface, model, and status summaries from backend provider view", () => {
    const providerView = provider({
      providerId: "provider-openai",
      displayName: "OpenAI",
      vendorId: "openai",
      providerCredentialId: "cred-openai",
      modelCatalog: {
        models: [
          { providerModelId: "gpt-4.1" },
          { providerModelId: "gpt-4.1-mini" },
          { providerModelId: "o4-mini" },
        ],
      },
      surfaces: [
        providerSurfaceBinding({
          surfaceId: "surface-b",
          displayName: "Responses API",
          runtime: {
            ...apiRuntime(ProviderProtocol.OPENAI_RESPONSES, "", "Responses API"),
            catalog: {
              models: [{ providerModelId: "gpt-4.1" }],
            },
          },
          status: {
            phase: ProviderSurfaceBindingPhase.READY,
          },
        }),
        providerSurfaceBinding({
          surfaceId: "surface-a",
          displayName: "Chat API",
          runtime: {
            ...apiRuntime(ProviderProtocol.OPENAI_COMPATIBLE, "", "Chat API"),
            catalog: {
              models: [{ providerModelId: "gpt-4.1-mini" }, { providerModelId: "o4-mini" }],
            },
          },
          status: {
            phase: ProviderSurfaceBindingPhase.REFRESHING,
          },
        }),
      ],
    });

    const model = providerModel(providerView);
    expect(model.modelCount()).toBe(3);
    expect(model.modelsSummary()).toBe("3 models");
    expect(model.status()).toMatchObject({
      color: "amber",
      label: "Refreshing",
      reason: "",
    });
  });

  it("does not synthesize cli surface details without surface basics", () => {
    expect(providerSurfaceBindingModel(providerSurfaceBinding({
      surfaceId: "surface-cli",
      runtime: cliRuntime("gemini", "Gemini CLI"),
    })).detail()).toBe("");
  });

  it("hides ready reason for single ready surface", () => {
    const model = providerModel(provider({
      providerId: "provider-openai",
      displayName: "OpenAI",
      surfaces: [
        providerSurfaceBinding({
          surfaceId: "surface-a",
          status: {
            phase: ProviderSurfaceBindingPhase.READY,
            reason: "Provider surface configuration is valid.",
          },
        }),
      ],
    }));

    expect(model.status()).toMatchObject({
      color: "green",
      label: "Ready",
      reason: "",
    });
  });

  it("hides synthesized reason for multi-surface providers", () => {
    const model = providerModel(provider({
      surfaces: [
        providerSurfaceBinding({
          surfaceId: "surface-a",
          status: {
            phase: ProviderSurfaceBindingPhase.READY,
          },
        }),
        providerSurfaceBinding({
          surfaceId: "surface-b",
          status: {
            phase: ProviderSurfaceBindingPhase.ERROR,
            reason: "credential material missing",
          },
        }),
      ],
    }));

    expect(model.status()).toMatchObject({
      color: "red",
      label: "Needs Attention",
      reason: "",
    });
  });

  it("formats oauth provider summary and surface basics for cards", () => {
    const model = providerModel(provider({
      credentialSubjectSummary: [
        { fieldId: "account-email", label: "Account", value: "d***v@example.com" },
        { fieldId: "tier", label: "Tier", value: "Pro" },
      ],
      surfaces: [
        providerSurfaceBinding({
          surfaceId: "surface-a",
          runtime: apiRuntime(ProviderProtocol.OPENAI_COMPATIBLE, "https://api.example.com/v1"),
        }),
      ],
    }));

    expect(model.oauthSummary()).toEqual([
      { key: "account-email", value: "d***v@example.com", emphasized: true },
    ]);
    expect(model.protocolLabels()).toEqual(["OpenAI Compatible"]);
    expect(providerSurfaceBindingModel(model.raw.surfaces[0]!).detail()).toBe("OpenAI Compatible · https://api.example.com/v1");
  });

  it("does not render synthetic api details for cli oauth cards", () => {
    const providerView = provider({
      surfaces: [
        providerSurfaceBinding({
          surfaceId: "surface-cli",
          runtime: cliRuntime("codex", "Codex"),
        }),
      ],
    });

    expect(providerSurfaceBindingModel(providerView.surfaces[0]!).detail()).toBe("");
  });
});

function apiRuntime(protocol: ProviderProtocolValue, baseUrl = "", displayName = ""): ProviderSurfaceRuntime {
  return {
    displayName,
    access: {
      case: "api",
      value: { protocol, baseUrl },
    },
  } as ProviderSurfaceRuntime;
}

function cliRuntime(cliId: string, displayName = ""): ProviderSurfaceRuntime {
  return {
    displayName,
    access: {
      case: "cli",
      value: { cliId },
    },
  } as ProviderSurfaceRuntime;
}

function providerSurfaceBinding(instance: Partial<ProviderSurfaceBindingView>): ProviderSurfaceBindingView {
  return instance as ProviderSurfaceBindingView;
}

function provider(providerView: Partial<ProviderView>): ProviderView {
  return providerView as ProviderView;
}
