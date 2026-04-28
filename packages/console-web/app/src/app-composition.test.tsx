import { describe, expect, it } from "vitest";
import {
  APP_ROUTES,
  APP_SECTIONS,
  NAV_ITEMS,
  buildNavItems,
  resolveNavigationSections,
  resolveSection
} from "./app-composition";

describe("app composition", () => {
  it("composes one nav item per default navigation section", () => {
    const sections = resolveNavigationSections({ grafanaAvailable: false });

    expect(NAV_ITEMS).toHaveLength(sections.length);
    expect(NAV_ITEMS.map((item) => item.key)).toEqual(sections.map((section) => section.key));
  });

  it("adds Grafana to navigation only after it is available", () => {
    const unavailableItems = buildNavItems(resolveNavigationSections({ grafanaAvailable: false }));
    const availableItems = buildNavItems(resolveNavigationSections({ grafanaAvailable: true }));

    expect(unavailableItems.some((item) => item.key === "grafana")).toBe(false);
    expect(availableItems.some((item) => item.key === "grafana")).toBe(true);
  });

  it("includes one primary route per section", () => {
    const paths = APP_ROUTES.map((route) => route.path);
    expect(APP_SECTIONS.map((section) => section.key).every((key) => paths.includes(key))).toBe(true);
  });

  it("resolves provider sections from the pathname", () => {
    const result = resolveSection("/providers");

    expect(result.activeKey).toBe("providers");
    expect(result.section.headline).toBe("Providers");
  });

  it("resolves chat section from the pathname", () => {
    const result = resolveSection("/chat");

    expect(result.activeKey).toBe("chat");
    expect(result.section.headline).toBe("Chat");
  });

  it("resolves network section from the pathname", () => {
    const result = resolveSection("/network");

    expect(result.activeKey).toBe("network");
    expect(result.section.headline).toBe("Network");
  });

  it("resolves Grafana section from the pathname", () => {
    const result = resolveSection("/grafana");

    expect(result.activeKey).toBe("grafana");
    expect(result.section.headline).toBe("Grafana");
  });

  it("resolves nested provider credential routes falling back to overview", () => {
    const result = resolveSection("/provider-credentials/oauth/callback");

    expect(result.activeKey).toBe("overview");
    expect(result.section.headline).toBe("Overview");
  });

  it("falls back to overview for unknown paths", () => {
    const result = resolveSection("/unknown");

    expect(result.activeKey).toBe("overview");
    expect(result.section.headline).toBe("Overview");
  });

  it("falls back to custom section when provided", () => {
    const customFallback = { key: "providers", label: "Providers", icon: "layers" as const, headline: "Providers" };
    const result = resolveSection("/unknown", customFallback);

    expect(result.activeKey).toBe("providers");
  });
});
