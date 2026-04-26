import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Text } from "@radix-ui/themes";
import { ProviderQuotaCard } from "./provider-quota-card";

describe("provider-quota-card", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders moving relative updated time from timestamp", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-18T16:00:00Z"));

    render(
      <ProviderQuotaCard
        loading={false}
        updatedAtLabel="04-18 15:40"
        updatedAtTimestamp="2026-04-18T15:40:00Z"
        rows={[{ id: "row-1", label: "Flash", value: "100%", progressPercent: 100 }]}
      />,
    );

    expect(screen.getByText("Updated 20m ago")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    expect(screen.getByText("Updated 21m ago")).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("prefers active query status over duplicate updated time", () => {
    render(
      <ProviderQuotaCard
        loading={false}
        status={{ color: "green", label: "Executed · 20m ago", reason: "" }}
        updatedAtLabel="20m ago"
        updatedAtTimestamp="2026-04-18T15:40:00Z"
        rows={[{ id: "row-1", label: "Flash", value: "100%", progressPercent: 100 }]}
      />,
    );

    expect(screen.getAllByText("Executed · 20m ago").length).toBeGreaterThan(0);
    expect(screen.queryByText("Updated 20m ago")).not.toBeInTheDocument();
  });

  it("renders quota controls below the header", () => {
    render(
      <ProviderQuotaCard
        loading={false}
        status={{ color: "green", label: "Executed · 20m ago", reason: "" }}
        rows={[{ id: "row-1", label: "Flash", value: "100%", progressPercent: 100 }]}
        controls={<Text>Org selector</Text>}
      />,
    );

    expect(screen.getAllByText("Quota").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Executed · 20m ago").length).toBeGreaterThan(0);
    expect(screen.getByText("Org selector")).toBeInTheDocument();
  });

  it("renders status and tier suffix in the same quota header", () => {
    render(
      <ProviderQuotaCard
        loading={false}
        status={{ color: "green", label: "Executed · 20m ago", reason: "" }}
        rows={[{ id: "row-1", label: "Flash", value: "100%", progressPercent: 100 }]}
        titleSuffix={<Text>Free</Text>}
      />,
    );

    expect(screen.getAllByText("Executed · 20m ago").length).toBeGreaterThan(0);
    expect(screen.getByText("Free")).toBeInTheDocument();
  });

  it("keeps subtle quota rows left aligned", () => {
    render(
      <ProviderQuotaCard
        loading={false}
        rows={[
          { id: "row-1", label: "llama3.1-8b", value: "1M/1M", progressPercent: 100 },
          { id: "row-2", label: "requests", value: "14.4K/14.4K", progressPercent: 100, subtle: true },
        ]}
      />,
    );

    const subtleRow = document.querySelector('[data-subtle="true"]');
    expect(subtleRow).not.toBeNull();
    expect((subtleRow as HTMLElement).style.paddingLeft).toBe("");
  });

  it("renders subtle quota status as a compact badge", () => {
    render(
      <ProviderQuotaCard
        loading={false}
        rows={[
          { id: "row-1", label: "requests", value: "14.4K/14.4K", progressPercent: 100, subtle: true },
        ]}
      />,
    );

    expect(screen.getByRole("meter", { name: "requests" })).toHaveAttribute("aria-valuetext", "14.4K/14.4K, 100% remaining");
  });

  it("renders unavailable quota progress as a neutral status", () => {
    render(
      <ProviderQuotaCard
        loading={false}
        rows={[
          { id: "row-1", label: "gemini-3-pro · RPD", value: "1K", progressUnavailableLabel: "limit only" },
        ]}
      />,
    );

    expect(screen.getByText("limit only")).toBeInTheDocument();
  });
});
