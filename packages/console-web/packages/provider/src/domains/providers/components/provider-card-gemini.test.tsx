import { describe, expect, it } from "vitest";
import type { ProviderView } from "@code-code/agent-contract/platform/management/v1";
import type { ProviderOwnerObservabilityItem } from "../api";
import { providerModel } from "../provider-model";
import { providerOwnerObservabilityModel } from "../provider-owner-observability-model";
import { readGeminiQuotaSummary } from "./provider-card-gemini";

describe("provider-card-gemini", () => {
  it("reads grouped quota rows as remaining and resetAt", () => {
    const summary = readGeminiQuotaSummary(
      providerModel(createGeminiAccount()),
      providerOwnerObservabilityModel(createGeminiItem(), "instance-1"),
      new Date("2026-04-17T05:00:00Z"),
      "UTC",
    );
    expect(summary).toEqual({
      tierLabel: "Pro",
      updatedAtLabel: "04-17 04:55",
      updatedAtTimestamp: "2026-04-17T04:55:00Z",
      rows: [
        { label: "Flash", percent: 73, resetAtLabel: "04-17 07:00" },
        { label: "Flash Lite", percent: 0, resetAtLabel: "04-17 08:00" },
      ],
    });
  });

  it("keeps pro row when quota response carries a real reset window", () => {
    const summary = readGeminiQuotaSummary(
      providerModel(createGeminiAccount()),
      providerOwnerObservabilityModel(createGeminiItemWithProWindow(), "instance-1"),
      new Date("2026-04-17T05:00:00Z"),
      "UTC",
    );
    expect(summary?.rows[0]).toEqual({ label: "Pro", percent: 60, resetAtLabel: "04-17 06:00" });
  });

  it("returns null when gemini quota metrics are missing", () => {
    expect(
      readGeminiQuotaSummary(
        providerModel(createGeminiAccount()),
        providerOwnerObservabilityModel({ cliId: "gemini-cli" }, "instance-1"),
      ),
    ).toBeNull();
  });

  it("reads tier label from provider summary", () => {
    expect(providerModel(createGeminiAccount()).oauthFieldValue("tier")).toBe("Google AI Pro");
  });

  it("normalizes long gemini marketing tier labels", () => {
    const summary = readGeminiQuotaSummary(
      providerModel(createGeminiIndividualsAccount()),
      providerOwnerObservabilityModel(createGeminiItem(), "instance-1"),
      new Date("2026-04-17T05:00:00Z"),
      "UTC",
    );

    expect(summary?.tierLabel).toBe("Free");
  });
});

function createGeminiItem(): ProviderOwnerObservabilityItem {
  return {
    cliId: "gemini-cli",
    lastProbeRun: [{ providerSurfaceBindingId: "instance-1", timestamp: "2026-04-17T04:55:00Z" }],
    runtimeMetrics: [
      {
        metricName: "gen_ai.provider.cli.oauth.gemini.pro.remaining.amount",
        rows: [{ labels: { provider_surface_binding_id: "instance-1" }, value: 0 }],
      },
      {
        metricName: "gen_ai.provider.cli.oauth.gemini.pro.remaining.fraction.percent",
        rows: [{ labels: { provider_surface_binding_id: "instance-1" }, value: 0 }],
      },
      {
        metricName: "gen_ai.provider.cli.oauth.gemini.pro.reset.timestamp.seconds",
        rows: [{ labels: { provider_surface_binding_id: "instance-1" }, value: 0 }],
      },
      {
        metricName: "gen_ai.provider.cli.oauth.gemini.flash.remaining.fraction.percent",
        rows: [{ labels: { provider_surface_binding_id: "instance-1" }, value: 73 }],
      },
      {
        metricName: "gen_ai.provider.cli.oauth.gemini.flash.reset.timestamp.seconds",
        rows: [{ labels: { provider_surface_binding_id: "instance-1" }, value: 1776409200 }],
      },
      {
        metricName: "gen_ai.provider.cli.oauth.gemini.flash.lite.remaining.amount",
        rows: [{ labels: { provider_surface_binding_id: "instance-1" }, value: 0 }],
      },
      {
        metricName: "gen_ai.provider.cli.oauth.gemini.flash.lite.remaining.fraction.percent",
        rows: [{ labels: { provider_surface_binding_id: "instance-1" }, value: 0 }],
      },
      {
        metricName: "gen_ai.provider.cli.oauth.gemini.flash.lite.reset.timestamp.seconds",
        rows: [{ labels: { provider_surface_binding_id: "instance-1" }, value: 1776412800 }],
      },
    ],
  };
}

function createGeminiItemWithProWindow(): ProviderOwnerObservabilityItem {
  const item = createGeminiItem();
  return {
    ...item,
    runtimeMetrics: item.runtimeMetrics?.map((metric) => {
      if (metric.metricName === "gen_ai.provider.cli.oauth.gemini.pro.remaining.amount") {
        return { ...metric, rows: [{ labels: { provider_surface_binding_id: "instance-1" }, value: 12 }] };
      }
      if (metric.metricName === "gen_ai.provider.cli.oauth.gemini.pro.remaining.fraction.percent") {
        return { ...metric, rows: [{ labels: { provider_surface_binding_id: "instance-1" }, value: 60 }] };
      }
      if (metric.metricName === "gen_ai.provider.cli.oauth.gemini.pro.reset.timestamp.seconds") {
        return { ...metric, rows: [{ labels: { provider_surface_binding_id: "instance-1" }, value: 1776405600 }] };
      }
      return metric;
    }),
  };
}

function createGeminiAccount(): ProviderView {
  return {
    credentialSubjectSummary: [{ fieldId: "tier", label: "Tier", value: "Google AI Pro" }],
  } as ProviderView;
}

function createGeminiIndividualsAccount(): ProviderView {
  return {
    credentialSubjectSummary: [{ fieldId: "tier", label: "Tier", value: "Gemini Code Assist for individuals" }],
  } as ProviderView;
}
