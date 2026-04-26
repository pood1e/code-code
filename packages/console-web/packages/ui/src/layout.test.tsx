import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ConsoleShellLayout } from "./layout";

const NAV_ITEMS = [
  { key: "overview", label: "Overview", icon: "grid" as const },
  { key: "providers", label: "Providers", icon: "layers" as const }
];

describe("ConsoleShellLayout", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders shell and triggers nav callback", () => {
    const onSelect = vi.fn();
    const onToggleTheme = vi.fn();

    render(
      <ConsoleShellLayout
        activeNavKey="overview"
        brand="Code Code"
        navItems={NAV_ITEMS}
        onSelectNav={onSelect}
        onToggleSidebar={() => undefined}
        onToggleTheme={onToggleTheme}
        theme="light"
        sidebarCollapsed={false}
      >
        <p>Body</p>
      </ConsoleShellLayout>
    );

    expect(screen.getByText("Body")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Providers/ }));
    expect(onSelect).toHaveBeenCalledWith("providers");

    fireEvent.click(screen.getByTestId("theme-toggle"));
    expect(onToggleTheme).toHaveBeenCalled();
  });

  it("shows icon-only items when sidebar is collapsed", () => {
    render(
      <ConsoleShellLayout
        activeNavKey="overview"
        brand="Code Code"
        navItems={NAV_ITEMS}
        onSelectNav={() => undefined}
        onToggleSidebar={() => undefined}
        onToggleTheme={() => undefined}
        theme="light"
        sidebarCollapsed
      >
        <p>Body</p>
      </ConsoleShellLayout>
    );

    expect(screen.queryByText("Overview")).not.toBeInTheDocument();
    expect(screen.queryByText("Providers")).not.toBeInTheDocument();
    expect(screen.queryByTestId("theme-toggle")).toBeInTheDocument();
  });

  it("triggers sidebar toggle from sidebar collapse button", () => {
    const onToggleSidebar = vi.fn();

    render(
      <ConsoleShellLayout
        activeNavKey="overview"
        brand="Code Code"
        navItems={NAV_ITEMS}
        onSelectNav={() => undefined}
        onToggleSidebar={onToggleSidebar}
        onToggleTheme={() => undefined}
        theme="light"
        sidebarCollapsed={false}
      >
        <p>Body</p>
      </ConsoleShellLayout>
    );

    fireEvent.click(screen.getByTestId("sidebar-toggle"));
    expect(onToggleSidebar).toHaveBeenCalledTimes(1);
  });
});
