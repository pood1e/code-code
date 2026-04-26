import { describe, expect, it } from "vitest";
import type { ProviderObservability } from "./api";
import { providerOwnerObservabilityModel, resolveProviderOwnerObservabilityItem } from "./provider-owner-observability-model";

describe("provider-owner-observability-model", () => {
  it("resolves cli observability item with case-insensitive cli id", () => {
    const detail = mockObservabilityDetail({
      owner: "cli",
      cliId: "codex",
    });

    const resolved = resolveProviderOwnerObservabilityItem(detail, { kind: "cli", cliId: "  CoDeX ", surfaceId: "codex-cli" });
    expect(resolved).toBe(detail.items?.[0]);
  });

  it("resolves vendor observability item with case-insensitive vendor id", () => {
    const detail = mockObservabilityDetail({
      owner: "vendor",
      vendorId: "minimax",
    });

    const resolved = resolveProviderOwnerObservabilityItem(detail, { kind: "vendor", vendorId: "  MiNiMaX ", surfaceId: "minimax-api" });
    expect(resolved).toBe(detail.items?.[0]);
  });

  it("does not resolve vendor owner from non-vendor item", () => {
    const detail = mockObservabilityDetail({
      owner: "cli",
      vendorId: "minimax",
    });

    const resolved = resolveProviderOwnerObservabilityItem(detail, { kind: "vendor", vendorId: "minimax", surfaceId: "minimax-api" });
    expect(resolved).toBeUndefined();
  });

  it("does not inject provider_surface_binding_id into runtime metric row filtering", () => {
    const model = providerOwnerObservabilityModel({
      owner: "vendor",
      vendorId: "google",
      runtimeMetrics: [
        {
          metricName: "gen_ai.provider.quota.limit",
          rows: [
            { labels: { provider_surface_binding_id: "instance-1", model_id: "model-a" }, value: 10 },
            { labels: { provider_surface_binding_id: "instance-2", model_id: "model-b" }, value: 20 },
          ],
        },
      ],
    }, "instance-1");
    expect(model?.metricRows("gen_ai.provider.quota.limit")).toHaveLength(2);
  });

  it("does not inject provider_surface_binding_id for cli owner runtime metrics", () => {
    const model = providerOwnerObservabilityModel({
      owner: "cli",
      cliId: "codex",
      runtimeMetrics: [
        {
          metricName: "gen_ai.provider.cli.oauth.codex.primary.window.used.percent",
          rows: [
            { labels: { provider_surface_binding_id: "instance-1", model_id: "model-a" }, value: 10 },
            { labels: { provider_surface_binding_id: "instance-2", model_id: "model-b" }, value: 20 },
          ],
        },
      ],
    }, "instance-1");
    expect(model?.metricRows("gen_ai.provider.cli.oauth.codex.primary.window.used.percent")).toHaveLength(2);
  });
});

function mockObservabilityDetail(item: NonNullable<ProviderObservability["items"]>[number]): ProviderObservability {
  return {
    providerId: "provider-1",
    items: [item],
  };
}
