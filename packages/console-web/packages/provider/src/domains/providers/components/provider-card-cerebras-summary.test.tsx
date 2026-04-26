import { describe, expect, it } from "vitest";
import type { ProviderOwnerObservabilityItem } from "../api";
import { providerOwnerObservabilityModel } from "../provider-owner-observability-model";
import { listCerebrasQuotaOrganizations, readCerebrasQuotaSummary } from "./provider-card-cerebras-summary";

describe("provider-card-cerebras-summary", () => {
  it("lists quota organizations with Personal first", () => {
    expect(listCerebrasQuotaOrganizations(providerOwnerObservabilityModel(createItem(), "cerebras-4ff931"))).toEqual([
      { id: "org-personal", label: "Personal" },
      { id: "org-team", label: "ac" },
    ]);
  });

  it("reads rich quota rows for one selected org", () => {
    const summary = readCerebrasQuotaSummary(
      providerOwnerObservabilityModel(createItem(), "cerebras-4ff931"),
      "org-personal",
      new Date("2026-04-18T15:10:00Z"),
      "UTC",
    );

    expect(summary).toEqual({
      updatedAtLabel: "04-18 15:00",
      updatedAtTimestamp: "2026-04-18T15:00:00Z",
      rows: [
        { id: "day:tokens:qwen-3-235b-a22b-instruct-2507", label: "qwen-3-235b-a22b-instruct-2507 · tokens", remaining: 900000000, limit: 2000000000, progressPercent: 45, subtle: false },
        { id: "day:tokens:llama3.1-8b", label: "llama3.1-8b · tokens", remaining: 1400000000, limit: 2000000000, progressPercent: 70, subtle: false },
        { id: "day:requests:llama3.1-8b", label: "llama3.1-8b · requests", remaining: 700, limit: 1000, progressPercent: 70, subtle: true },
      ],
    });
  });

  it("groups the same model quota metrics together", () => {
    const summary = readCerebrasQuotaSummary(
      providerOwnerObservabilityModel(createItem(), "cerebras-4ff931"),
      "org-personal",
      new Date("2026-04-18T15:10:00Z"),
      "UTC",
    );

    expect(summary?.rows.map((row) => row.label)).toEqual([
      "qwen-3-235b-a22b-instruct-2507 · tokens",
      "llama3.1-8b · tokens",
      "llama3.1-8b · requests",
    ]);
  });

  it("returns null when no selected org rows exist", () => {
    expect(
      readCerebrasQuotaSummary(
        providerOwnerObservabilityModel({ owner: "vendor", vendorId: "cerebras" }, "cerebras-4ff931"),
        "org-personal",
      ),
    ).toBeNull();
  });
});

function createItem(): ProviderOwnerObservabilityItem {
  return {
    owner: "vendor",
    vendorId: "cerebras",
    lastProbeRun: [{ providerSurfaceBindingId: "cerebras-4ff931", timestamp: "2026-04-18T15:00:00Z" }],
    runtimeMetrics: [
      {
        metricName: "gen_ai.provider.quota.remaining",
        rows: [
          quotaRow("org-personal", "Personal", "llama3.1-8b", "day", "tokens", 1400000000),
          quotaRow("org-personal", "Personal", "llama3.1-8b", "hour", "tokens", 70000000),
          quotaRow("org-personal", "Personal", "llama3.1-8b", "day", "requests", 700),
          quotaRow("org-personal", "Personal", "qwen-3-235b-a22b-instruct-2507", "day", "tokens", 900000000),
          quotaRow("org-team", "ac", "gpt-oss-120b", "day", "tokens", 500000000),
        ],
      },
      {
        metricName: "gen_ai.provider.quota.limit",
        rows: [
          quotaRow("org-personal", "Personal", "llama3.1-8b", "day", "tokens", 2000000000),
          quotaRow("org-personal", "Personal", "llama3.1-8b", "hour", "tokens", 100000000),
          quotaRow("org-personal", "Personal", "llama3.1-8b", "day", "requests", 1000),
          quotaRow("org-personal", "Personal", "qwen-3-235b-a22b-instruct-2507", "day", "tokens", 2000000000),
          quotaRow("org-team", "ac", "gpt-oss-120b", "day", "tokens", 2000000000),
        ],
      },
    ],
  };
}

function quotaRow(
  orgID: string,
  orgName: string,
  modelID: string,
  window: string,
  resource: string,
  value: number,
) {
  return {
    labels: {
      provider_surface_binding_id: "cerebras-4ff931",
      org_id: orgID,
      org_name: orgName,
      model_id: modelID,
      window,
      resource,
    },
    value,
  };
}
