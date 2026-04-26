import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./app";

function stubMatchMedia(matches: boolean) {
  const matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn()
  }));

  vi.stubGlobal("matchMedia", matchMedia);
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: matchMedia
  });
}

describe("App", () => {
  afterEach(() => {
    cleanup();
    window.location.hash = "";
    window.localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("renders shell layout and switches section from navigation", async () => {
    stubMatchMedia(false);
    window.location.hash = "#/overview";

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /Providers/ }));

    await waitFor(() => {
      expect(window.location.hash).toContain("providers");
    });
  });

  it("navigates to chat from sidebar", async () => {
    stubMatchMedia(false);
    window.location.hash = "#/overview";

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /Chat/ }));

    await waitFor(() => {
      expect(window.location.hash).toContain("chat");
    });
  });

  it("toggles sidebar controls on mobile viewport", async () => {
    stubMatchMedia(true);
    window.location.hash = "#/overview";

    render(<App />);

    // Sidebar is collapsed on mobile — theme toggle should still be visible in sidebar
    expect(screen.getByTestId("theme-toggle")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("sidebar-toggle"));

    await waitFor(() => {
      expect(screen.getByTestId("theme-toggle")).toBeInTheDocument();
    });
  });

  it("restores the persisted theme mode", async () => {
    stubMatchMedia(false);
    window.location.hash = "#/overview";
    window.localStorage.setItem("console-web-theme-mode", "dark");

    const { container } = render(<App />);

    await waitFor(() => {
      expect(container.querySelector(".radix-themes.dark")).toBeInTheDocument();
    });
  });

  it("persists theme changes after toggle", async () => {
    stubMatchMedia(false);
    window.location.hash = "#/overview";

    render(<App />);

    fireEvent.click(screen.getByTestId("theme-toggle"));

    await waitFor(() => {
      expect(window.localStorage.getItem("console-web-theme-mode")).toBe("dark");
    });
  });
});
