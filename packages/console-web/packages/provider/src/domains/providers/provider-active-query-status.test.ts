import { describe, expect, it } from "vitest";
import { readProviderActiveQueryStatus } from "./provider-active-query-status";
import { providerOwnerObservabilityModel } from "./provider-owner-observability-model";

describe("provider-active-query-status", () => {
  it("maps last probe outcome gauge to executed", () => {
    const status = readProviderActiveQueryStatus(
      providerOwnerObservabilityModel({
        owner: "vendor",
        vendorId: "cerebras",
        lastProbeRun: [{ providerSurfaceBindingId: "inst-1", timestamp: "2026-04-18T15:00:00Z" }],
        lastProbeOutcome: [{ providerSurfaceBindingId: "inst-1", value: 1 }],
      }, "inst-1"),
      { kind: "vendor", vendorId: "cerebras", surfaceId: "cerebras-api" },
      new Date("2026-04-18T15:10:00Z"),
      "UTC",
    );

    expect(status).toEqual({
      color: "green",
      label: "Executed · 10m ago",
      reason: "",
    });
  });

  it("maps last probe outcome gauge to auth blocked", () => {
    const status = readProviderActiveQueryStatus(
      providerOwnerObservabilityModel({
        owner: "vendor",
        vendorId: "cerebras",
        lastProbeRun: [{ providerSurfaceBindingId: "inst-1", timestamp: "2026-04-18T15:00:00Z" }],
        lastProbeOutcome: [{ providerSurfaceBindingId: "inst-1", value: 3 }],
      }, "inst-1"),
      { kind: "vendor", vendorId: "cerebras", surfaceId: "cerebras-api" },
      new Date("2026-04-18T15:10:00Z"),
      "UTC",
    );

    expect(status).toEqual({
      color: "red",
      label: "Auth Blocked · 10m ago",
      reason: "authjs.session-token needs refresh.",
    });
  });
});
