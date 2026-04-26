import { describe, expect, it } from "vitest";
import type { ProviderView } from "@code-code/agent-contract/platform/management/v1";
import type { ProviderOwnerObservabilityItem } from "../api";
import { providerModel } from "../provider-model";
import { providerOwnerObservabilityModel } from "../provider-owner-observability-model";
import { readAntigravityQuotaSummary } from "./provider-card-antigravity";

describe("provider-card-antigravity", () => {
  it("groups model scoped quota rows into compact quota buckets", () => {
    const summary = readAntigravityQuotaSummary(
      providerModel(createAccount()),
      providerOwnerObservabilityModel(createItem(), "instance-1"),
      new Date("2026-04-17T05:00:00Z"),
      "UTC",
    );
    expect(summary).toEqual({
      tierLabel: "Google AI Pro",
      updatedAtLabel: "04-17 04:55",
      updatedAtTimestamp: "2026-04-17T04:55:00Z",
      rows: [
        { label: "Gemini Pro · 5h", groupId: "gemini-pro", percent: 30, resetAtLabel: "04-17 06:00" },
        { label: "Gemini Flash · 5h", groupId: "gemini-flash", percent: 90, resetAtLabel: "04-17 08:00" },
        { label: "Claude / OpenAI · 5h", groupId: "claude-openai", percent: 15, resetAtLabel: "04-17 08:00" },
      ],
    });
  });

  it("folds flash-image into Gemini Flash and carries longer cadence labels", () => {
    const summary = readAntigravityQuotaSummary(
      providerModel(createAccount()),
      providerOwnerObservabilityModel(createLongWindowItem(), "instance-1"),
      new Date("2026-04-17T05:00:00Z"),
      "UTC",
    );
    expect(summary?.rows).toEqual([
      { label: "Gemini Pro · 3d", groupId: "gemini-pro", percent: 100, resetAtLabel: "04-20 05:00" },
      { label: "Gemini Flash · 7d", groupId: "gemini-flash", percent: 100, resetAtLabel: "04-24 05:00" },
    ]);
  });
});

function createItem(): ProviderOwnerObservabilityItem {
  return {
    cliId: "antigravity",
    lastProbeRun: [{ providerSurfaceBindingId: "instance-1", timestamp: "2026-04-17T04:55:00Z" }],
    runtimeMetrics: [
      {
        metricName: "gen_ai.provider.cli.oauth.antigravity.model.quota.remaining.fraction.percent",
        rows: [
          { labels: { provider_surface_binding_id: "instance-1", model_id: "gemini-2.5-pro" }, value: 60 },
          { labels: { provider_surface_binding_id: "instance-1", model_id: "gemini-3.1-pro-high" }, value: 30 },
          { labels: { provider_surface_binding_id: "instance-1", model_id: "gemini-2.5-flash" }, value: 90 },
          { labels: { provider_surface_binding_id: "instance-1", model_id: "claude-sonnet-4-6" }, value: 15 },
          { labels: { provider_surface_binding_id: "instance-1", model_id: "gpt-oss-120b-medium" }, value: 80 },
        ],
      },
      {
        metricName: "gen_ai.provider.cli.oauth.antigravity.model.quota.reset.timestamp.seconds",
        rows: [
          { labels: { provider_surface_binding_id: "instance-1", model_id: "gemini-2.5-pro" }, value: 1776405600 },
          { labels: { provider_surface_binding_id: "instance-1", model_id: "gemini-3.1-pro-high" }, value: 1776409200 },
          { labels: { provider_surface_binding_id: "instance-1", model_id: "gemini-2.5-flash" }, value: 1776412800 },
          { labels: { provider_surface_binding_id: "instance-1", model_id: "claude-sonnet-4-6" }, value: 1776412800 },
          { labels: { provider_surface_binding_id: "instance-1", model_id: "gpt-oss-120b-medium" }, value: 1776412800 },
        ],
      },
    ],
  };
}

function createAccount(): ProviderView {
  return {
    credentialSubjectSummary: [{ fieldId: "tier", label: "Tier", value: "Google AI Pro" }],
  } as ProviderView;
}

function createLongWindowItem(): ProviderOwnerObservabilityItem {
  return {
    cliId: "antigravity",
    lastProbeRun: [{ providerSurfaceBindingId: "instance-1", timestamp: "2026-04-17T04:55:00Z" }],
    runtimeMetrics: [
      {
        metricName: "gen_ai.provider.cli.oauth.antigravity.model.quota.remaining.fraction.percent",
        rows: [
          { labels: { provider_surface_binding_id: "instance-1", model_id: "gemini-3.1-pro-high" }, value: 100 },
          { labels: { provider_surface_binding_id: "instance-1", model_id: "gemini-3.1-flash-image" }, value: 100 },
        ],
      },
      {
        metricName: "gen_ai.provider.cli.oauth.antigravity.model.quota.reset.timestamp.seconds",
        rows: [
          { labels: { provider_surface_binding_id: "instance-1", model_id: "gemini-3.1-pro-high" }, value: 1776661200 },
          { labels: { provider_surface_binding_id: "instance-1", model_id: "gemini-3.1-flash-image" }, value: 1777006800 },
        ],
      },
    ],
  };
}
