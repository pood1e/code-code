import { describe, expect, it } from "vitest";
import type { ProviderOwnerObservabilityItem } from "../api";
import { providerOwnerObservabilityModel } from "../provider-owner-observability-model";
import { readMiniMaxQuotaSummary } from "./provider-card-minimax-summary";

describe("provider-card-minimax-summary", () => {
  it("reads model scoped minimax quota rows from runtime metrics", () => {
    const summary = readMiniMaxQuotaSummary(
      providerOwnerObservabilityModel(createItem(), "provider-minimax"),
      new Date("2026-04-17T08:00:00Z"),
      "UTC",
    );

    expect(summary).not.toBeNull();
    expect(summary?.updatedAtLabel).toBe("04-17 00:00");
    expect(summary?.rows).toEqual([
      {
        modelId: "MiniMax-M2.7",
        label: "MiniMax M2.7",
        remaining: 128,
        total: 200,
        progressPercent: 64,
        resetAtLabel: "04-17 16:00",
      },
      {
        modelId: "MiniMax-M2.7-Pro",
        label: "MiniMax M2.7 Pro",
        remaining: 60,
        total: 120,
        progressPercent: 50,
        resetAtLabel: "04-18 00:00",
      },
      {
        modelId: "coding-plan-search",
        label: "Coding Search",
        remaining: 49,
        total: 450,
        progressPercent: 49 / 450 * 100,
        resetAtLabel: "04-17 16:00",
      },
      {
        modelId: "coding-plan-vlm",
        label: "Coding Vision",
        remaining: 78,
        total: 450,
        progressPercent: 78 / 450 * 100,
        resetAtLabel: "04-17 16:00",
      },
    ]);
  });

  it("keeps quota rows when percent metric is missing", () => {
    const item = createItem();
    item.runtimeMetrics = item.runtimeMetrics?.filter((metric) => metric.metricName !== "gen_ai.provider.quota.remaining.fraction.percent");

    const summary = readMiniMaxQuotaSummary(
      providerOwnerObservabilityModel(item, "provider-minimax"),
      new Date("2026-04-17T08:00:00Z"),
      "UTC",
    );

    expect(summary?.rows[0]).toEqual({
      modelId: "MiniMax-M2.7",
      label: "MiniMax M2.7",
      remaining: 128,
      total: 200,
      progressPercent: 64,
      resetAtLabel: "04-17 16:00",
    });
    expect(summary?.rows[1]).toEqual({
      modelId: "MiniMax-M2.7-Pro",
      label: "MiniMax M2.7 Pro",
      remaining: 60,
      total: 120,
      progressPercent: 50,
      resetAtLabel: "04-18 00:00",
    });
  });
});

function createItem(): ProviderOwnerObservabilityItem {
  return {
    owner: "vendor",
    vendorId: "minimax",
    runtimeMetrics: [
      {
        metricName: "gen_ai.provider.quota.remaining",
        rows: [
          { labels: { provider_surface_binding_id: "provider-minimax", model_id: "coding-plan-search", resource: "requests" }, value: 49 },
          { labels: { provider_surface_binding_id: "provider-minimax", model_id: "coding-plan-vlm", resource: "requests" }, value: 78 },
          { labels: { provider_surface_binding_id: "provider-minimax", model_id: "MiniMax-M2.7", resource: "requests" }, value: 128 },
          { labels: { provider_surface_binding_id: "provider-minimax", model_id: "MiniMax-M2.7-Pro", resource: "requests" }, value: 60 },
        ],
      },
      {
        metricName: "gen_ai.provider.quota.limit",
        rows: [
          { labels: { provider_surface_binding_id: "provider-minimax", model_id: "coding-plan-search", resource: "requests" }, value: 450 },
          { labels: { provider_surface_binding_id: "provider-minimax", model_id: "coding-plan-vlm", resource: "requests" }, value: 450 },
          { labels: { provider_surface_binding_id: "provider-minimax", model_id: "MiniMax-M2.7", resource: "requests" }, value: 200 },
          { labels: { provider_surface_binding_id: "provider-minimax", model_id: "MiniMax-M2.7-Pro", resource: "requests" }, value: 120 },
        ],
      },
      {
        metricName: "gen_ai.provider.quota.remaining.fraction.percent",
        rows: [
          { labels: { provider_surface_binding_id: "provider-minimax", model_id: "coding-plan-search", resource: "requests" }, value: 49 / 450 * 100 },
          { labels: { provider_surface_binding_id: "provider-minimax", model_id: "coding-plan-vlm", resource: "requests" }, value: 78 / 450 * 100 },
          { labels: { provider_surface_binding_id: "provider-minimax", model_id: "MiniMax-M2.7", resource: "requests" }, value: 64 },
          { labels: { provider_surface_binding_id: "provider-minimax", model_id: "MiniMax-M2.7-Pro", resource: "requests" }, value: 50 },
        ],
      },
      {
        metricName: "gen_ai.provider.quota.reset.timestamp.seconds",
        rows: [
          { labels: { provider_surface_binding_id: "provider-minimax", model_id: "coding-plan-search", resource: "requests" }, value: 1776441600 },
          { labels: { provider_surface_binding_id: "provider-minimax", model_id: "coding-plan-vlm", resource: "requests" }, value: 1776441600 },
          { labels: { provider_surface_binding_id: "provider-minimax", model_id: "MiniMax-M2.7", resource: "requests" }, value: 1776441600 },
          { labels: { provider_surface_binding_id: "provider-minimax", model_id: "MiniMax-M2.7-Pro", resource: "requests" }, value: 1776470400 },
        ],
      },
    ],
    lastProbeRun: [{ providerSurfaceBindingId: "provider-minimax", timestamp: "2026-04-17T00:00:00Z" }],
  };
}
