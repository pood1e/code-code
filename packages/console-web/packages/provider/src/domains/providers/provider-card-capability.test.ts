import { describe, expect, it } from "vitest";
import type { ProviderSurfaceRuntime } from "@code-code/agent-contract/provider/v1";
import type { CLI } from "@code-code/agent-contract/platform/support/v1";
import type { Vendor } from "@code-code/agent-contract/platform/support/v1";
import type { ProviderView } from "@code-code/agent-contract/platform/management/v1";
import { ProviderProtocol } from "./provider-protocol";
import { resolveProviderCardOwner } from "./provider-card-capability";

describe("provider-card-capability", () => {
  it("returns null when cli does not declare provider card support", () => {
    const provider = createCLIProvider();
    const clis: CLI[] = [{ cliId: "codex", displayName: "Codex CLI" }];

    expect(
      resolveProviderCardOwner({
        provider,
        clis,
        vendors: [],
      }),
    ).toBeNull();
  });

  it("returns cli owner when supported", () => {
    const provider = createCLIProvider();
    const clis: CLI[] = [{
      cliId: "codex",
      displayName: "Codex CLI",
      oauth: {
        providerBinding: { surfaceId: "codex-cli" },
        providerCard: { enabled: true },
      },
    }];

    expect(
      resolveProviderCardOwner({
        provider,
        clis,
        vendors: [],
      }),
    ).toEqual({ kind: "cli", cliId: "codex", surfaceId: "codex-cli", providerSurfaceBindingId: "codex-cli" });
  });

  it("returns vendor owner when supported", () => {
    const provider: ProviderView = {
      providerId: "provider-1",
      displayName: "OpenAI",
      vendorId: "openai",
      surfaces: [{
        surfaceId: "openai-api",
        providerId: "provider-1",
        vendorId: "openai",
        runtime: apiRuntime(),
      }],
    };
    const vendors: Vendor[] = [{
      vendor: {
        vendorId: "openai",
        displayName: "OpenAI",
      },
      providerBindings: [{
        providerBinding: { surfaceId: "openai-api" },
        providerCard: { enabled: true },
        surfaceTemplates: [],
      }],
    }];

    expect(
      resolveProviderCardOwner({
        provider,
        clis: [],
        vendors,
      }),
    ).toEqual({ kind: "vendor", vendorId: "openai", surfaceId: "openai-api", providerSurfaceBindingId: "openai-api" });
  });
});

function createCLIProvider(): ProviderView {
  return {
    providerId: "provider-1",
    displayName: "Codex",
    surfaces: [{
      surfaceId: "codex-cli",
      providerId: "provider-1",
      runtime: cliRuntime("codex"),
    }],
  };
}

function cliRuntime(cliId: string): ProviderSurfaceRuntime {
  return {
    displayName: "Codex",
    access: {
      case: "cli",
      value: { cliId },
    },
  } as ProviderSurfaceRuntime;
}

function apiRuntime(): ProviderSurfaceRuntime {
  return {
    displayName: "Responses",
    access: {
      case: "api",
      value: { protocol: ProviderProtocol.OPENAI_COMPATIBLE, baseUrl: "https://api.openai.com/v1" },
    },
  } as ProviderSurfaceRuntime;
}
