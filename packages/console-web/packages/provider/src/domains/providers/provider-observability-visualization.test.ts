import { describe, expect, it } from "vitest";
import type { ProviderSurfaceRuntime } from "@code-code/agent-contract/provider/v1";
import type { CLI } from "@code-code/agent-contract/platform/support/v1";
import type { ProviderView, ProviderSurfaceBindingView } from "@code-code/agent-contract/platform/management/v1";
import type { Vendor } from "@code-code/agent-contract/platform/support/v1";
import { ProviderProtocol } from "./provider-protocol";
import {
  providerActiveQueryProviderIDs,
  resolveProviderObservabilityOwner,
  providerSupportsActiveQuery,
} from "./provider-observability-visualization";

describe("provider-observability-visualization", () => {
  it("resolves cli owner from cli surface", () => {
    const owner = resolveProviderObservabilityOwner(createCLIInstance("codex"));

    expect(owner).toEqual({ kind: "cli", cliId: "codex", surfaceId: "codex-cli" });
  });

  it("resolves vendor owner from api surface", () => {
    const owner = resolveProviderObservabilityOwner(createVendorInstance("minimax"));

    expect(owner).toEqual({ kind: "vendor", vendorId: "minimax", surfaceId: "minimax-api" });
  });

  it("detects active query support from observability profiles", () => {
    expect(
      providerSupportsActiveQuery(
        createAccount([{ surfaceId: "minimax-api", runtime: apiRuntime(), vendorId: "minimax" }]),
        [],
        [createVendor("minimax", true, "minimax-api")],
      ),
    ).toBe(true);
  });

  it("collects active query provider id only from supported surfaces", () => {
    expect(
      providerActiveQueryProviderIDs(
        createAccount([
          { surfaceId: "codex-cli", runtime: cliRuntime("codex") },
          { surfaceId: "openai-api", runtime: apiRuntime(), vendorId: "openai" },
        ]),
        [createCLI("codex", true, "codex-cli")],
        [createVendor("openai", false, "openai-api")],
      ),
    ).toEqual(["provider-1"]);
  });

  it("deduplicates active query probe targets per provider", () => {
    expect(
      providerActiveQueryProviderIDs(
        createAccount([
          { surfaceId: "codex-cli", runtime: cliRuntime("codex") },
          { surfaceId: "codex-cli", runtime: cliRuntime("codex") },
          { surfaceId: "minimax-api", runtime: apiRuntime(), vendorId: "minimax" },
          { surfaceId: "minimax-api", runtime: apiRuntime(), vendorId: "minimax" },
        ]),
        [createCLI("codex", true, "codex-cli")],
        [createVendor("minimax", true, "minimax-api")],
      ),
    ).toEqual(["provider-1"]);
  });

  it("detects active query with normalized owner ids", () => {
    expect(
      providerSupportsActiveQuery(
        createAccount([createCLIInstance("  CoDeX ")]),
        [createCLI("codex", true, "codex-cli")],
        [],
      ),
    ).toBe(true);
    expect(
      providerSupportsActiveQuery(
        createAccount([createVendorInstance("  MiNiMaX ")]),
        [],
        [createVendor("minimax", true, "minimax-api")],
      ),
    ).toBe(true);
  });
});

function createCLIInstance(cliId: string): ProviderSurfaceBindingView {
  return {
    surfaceId: "codex-cli",
    runtime: cliRuntime(cliId),
  };
}

function createVendorInstance(vendorId: string): ProviderSurfaceBindingView {
  return {
    surfaceId: "minimax-api",
    vendorId,
    runtime: apiRuntime(),
  };
}

function cliRuntime(cliId: string): ProviderSurfaceRuntime {
  return {
    access: {
      case: "cli",
      value: { cliId },
    },
  } as ProviderSurfaceRuntime;
}

function apiRuntime(): ProviderSurfaceRuntime {
  return {
    access: {
      case: "api",
      value: { protocol: ProviderProtocol.OPENAI_COMPATIBLE, baseUrl: "https://api.example.com/v1" },
    },
  } as ProviderSurfaceRuntime;
}

function createAccount(surfaces: ProviderView["surfaces"]): ProviderView {
  return {
    providerId: "provider-1",
    displayName: "Provider",
    surfaces,
  };
}

function createCLI(cliId: string, activeQuery = false, surfaceId = "codex-cli"): CLI {
  return {
    cliId,
    oauth: {
      providerBinding: { surfaceId },
      observability: {
        profiles: activeQuery ? [{ collection: { case: "activeQuery", value: {} } }] : [],
      },
    },
  };
}

function createVendor(vendorId: string, activeQuery = false, surfaceId = "minimax-api"): Vendor {
  return {
    vendor: { vendorId },
    providerBindings: [{
      providerBinding: { surfaceId },
      surfaceTemplates: [],
      observability: {
        profiles: activeQuery ? [{ collection: { case: "activeQuery", value: {} } }] : [],
      },
    }],
  };
}
