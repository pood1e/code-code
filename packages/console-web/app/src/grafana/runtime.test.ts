import { afterEach, describe, expect, it, vi } from "vitest";
import { probeGrafanaAvailability, readGrafanaBaseUrl } from "./runtime";

function grafanaEnv(baseUrl: string): ImportMetaEnv {
  return {
    BASE_URL: "/",
    DEV: true,
    MODE: "test",
    PROD: false,
    SSR: false,
    VITE_GRAFANA_BASE_URL: baseUrl
  };
}

describe("Grafana runtime", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("normalizes configured Grafana base URLs", () => {
    expect(readGrafanaBaseUrl(grafanaEnv("grafana/"))).toBe("/grafana");
    expect(readGrafanaBaseUrl(grafanaEnv("https://grafana.example.com/"))).toBe(
      "https://grafana.example.com"
    );
  });

  it("rejects console HTML fallback responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response("<!doctype html><div id=\"root\"></div>", {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" }
      })
    ));

    await expect(probeGrafanaAvailability("/grafana/api/health")).resolves.toBe(false);
  });

  it("accepts Grafana health JSON responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      Response.json({
        commit: "dev",
        database: "ok",
        version: "13.0.1"
      })
    ));

    await expect(probeGrafanaAvailability("/grafana/api/health")).resolves.toBe(true);
  });

  it("treats auth-protected Grafana responses as available", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response("unauthorized", { status: 401 })
    ));

    await expect(probeGrafanaAvailability("/grafana/api/health")).resolves.toBe(true);
  });
});
