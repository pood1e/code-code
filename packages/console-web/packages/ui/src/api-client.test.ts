import { afterEach, describe, expect, it, vi } from "vitest";
import { jsonRequest } from "./api-client";

describe("jsonRequest", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns parsed JSON for success responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ items: [{ id: "model-1" }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    ));

    await expect(jsonRequest<{ items: { id: string }[] }>("/api/healthz")).resolves.toEqual({
      items: [{ id: "model-1" }]
    });
  });

  it("prefers error_detail over status text", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error_detail: "provider_unavailable" }), {
        status: 503,
        headers: { "Content-Type": "application/json" }
      })
    ));

    await expect(jsonRequest("/api/healthz")).rejects.toThrow("provider_unavailable");
  });

  it("falls back to the HTTP status for non-JSON errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response("upstream timeout", {
        status: 504
      })
    ));

    await expect(jsonRequest("/api/healthz")).rejects.toThrow("HTTP Error 504");
  });
});
