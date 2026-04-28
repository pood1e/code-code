import { describe, expect, it, vi } from "vitest";
import {
  providerAuthenticationExpiry,
  providerAuthenticationStatus,
  providerAuthenticationTokenStatus,
} from "./provider-authentication-view";

describe("provider-authentication-view", () => {
  it("uses credential readiness as the primary auth status", () => {
    expect(providerAuthenticationStatus(true, "")).toMatchObject({
      label: "Ready",
      color: "green",
      reason: "",
    });
    expect(providerAuthenticationStatus(false, "credential material missing")).toMatchObject({
      label: "Needs Attention",
      color: "red",
      reason: "credential material missing",
    });
    expect(providerAuthenticationStatus(undefined, "")).toMatchObject({
      label: "Unknown",
      color: "gray",
    });
  });

  it("reports oauth token window separately from readiness", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-16T00:00:00Z"));

    expect(providerAuthenticationTokenStatus("")).toMatchObject({
      label: "Not Reported",
      color: "gray",
    });
    expect(providerAuthenticationTokenStatus("2026-04-15T00:00:00Z")).toMatchObject({
      label: "Expired",
      color: "red",
    });
    expect(providerAuthenticationTokenStatus("2026-04-16T12:00:00Z")).toMatchObject({
      label: "Expiring Soon",
      color: "amber",
    });
    expect(providerAuthenticationTokenStatus("2026-04-20T00:00:00Z")).toMatchObject({
      label: "Valid",
      color: "green",
    });

    vi.useRealTimers();
  });

  it("formats expiry timestamps for display", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-16T00:00:00Z"));

    expect(providerAuthenticationExpiry("")).toBe("Not reported");
    expect(providerAuthenticationExpiry("2026-04-16T12:00:00Z")).toContain("in 12h");

    vi.useRealTimers();
  });
});
