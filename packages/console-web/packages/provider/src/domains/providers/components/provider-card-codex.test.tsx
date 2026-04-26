import { describe, expect, it } from "vitest";
import type { ProviderView } from "@code-code/agent-contract/platform/management/v1";
import { providerModel } from "../provider-model";
import type { ProviderOwnerObservabilityItem } from "../api";
import { providerOwnerObservabilityModel } from "../provider-owner-observability-model";
import { readCodexFeatureLabels, readCodexQuotaSummary } from "./provider-card-codex";

describe("provider-card-codex", () => {
  it("reads primary and secondary quota rows for the selected provider surface", () => {
    const summary = readCodexQuotaSummary(
      providerOwnerObservabilityModel(createCodexItem(), "instance-1"),
      new Date("2026-04-17T05:00:00Z"),
      "UTC",
    );
    expect(summary).toEqual({
      blocked: true,
      tierLabel: "Pro",
      updatedAtLabel: "04-17 04:55",
      updatedAtTimestamp: "2026-04-17T04:55:00Z",
      rows: [
        { label: "5h", percent: 58, resetAtLabel: "04-17 06:00" },
        { label: "7d", percent: 0, resetAtLabel: "04-18 05:00" },
      ],
    });
  });

  it("returns null when codex quota metrics are missing", () => {
    expect(readCodexQuotaSummary(providerOwnerObservabilityModel({ cliId: "codex" }, "instance-1"))).toBeNull();
  });

  it("shows spark badge only when the probed catalog contains spark", () => {
    expect(readCodexFeatureLabels(providerModel(createCodexAccount(["gpt-5.3-codex-spark"])))).toEqual([
      "gpt-5.3-codex-spark",
    ]);
    expect(readCodexFeatureLabels(providerModel(createCodexAccount(["gpt-5.3-codex"])))).toEqual([]);
  });
});

function createCodexItem(): ProviderOwnerObservabilityItem {
  return {
    cliId: "codex",
    lastProbeRun: [{ providerSurfaceBindingId: "instance-1", timestamp: "2026-04-17T04:55:00Z" }],
    runtimeMetrics: [
      {
        metricName: "gen_ai.provider.cli.oauth.codex.limit.reached",
        rows: [{ labels: { provider_surface_binding_id: "instance-1" }, value: 1 }],
      },
      {
        metricName: "gen_ai.provider.cli.oauth.codex.primary.window.used.percent",
        rows: [{ labels: { provider_surface_binding_id: "instance-1" }, value: 42 }],
      },
      {
        metricName: "gen_ai.provider.cli.oauth.codex.primary.window.reset.timestamp.seconds",
        rows: [{ labels: { provider_surface_binding_id: "instance-1" }, value: 1776405600 }],
      },
      {
        metricName: "gen_ai.provider.cli.oauth.codex.secondary.window.used.percent",
        rows: [{ labels: { provider_surface_binding_id: "instance-1" }, value: 100 }],
      },
      {
        metricName: "gen_ai.provider.cli.oauth.codex.secondary.window.reset.timestamp.seconds",
        rows: [{ labels: { provider_surface_binding_id: "instance-1" }, value: 1776488400 }],
      },
      {
        metricName: "gen_ai.provider.cli.oauth.codex.plan.type.code",
        rows: [{ labels: { provider_surface_binding_id: "instance-1" }, value: 5 }],
      },
    ],
  };
}

function createCodexAccount(modelIDs: string[]): ProviderView {
  return {
    surfaces: [
      {
        runtime: {
          catalog: {
            models: modelIDs.map((providerModelId) => ({ providerModelId })),
          },
        },
      },
    ],
  } as ProviderView;
}
