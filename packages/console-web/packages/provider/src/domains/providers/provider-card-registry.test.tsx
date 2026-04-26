import { describe, expect, it } from "vitest";
import { resolveProviderCardRenderer } from "./provider-card-registry";

describe("provider-card-registry", () => {
  it("returns codex renderer for supported codex owner", () => {
    expect(resolveProviderCardRenderer({ kind: "cli", cliId: "codex" })).not.toBeNull();
  });

  it("normalizes cli owner id when resolving renderer", () => {
    expect(resolveProviderCardRenderer({ kind: "cli", cliId: "  CoDeX  " })).not.toBeNull();
  });

  it("returns antigravity renderer for supported antigravity owner", () => {
    expect(resolveProviderCardRenderer({ kind: "cli", cliId: "antigravity" })).not.toBeNull();
  });

  it("returns gemini renderer for supported gemini owner", () => {
    expect(resolveProviderCardRenderer({ kind: "cli", cliId: "gemini-cli" })).not.toBeNull();
  });

  it("returns minimax renderer for supported minimax owner", () => {
    expect(resolveProviderCardRenderer({ kind: "vendor", vendorId: "minimax" })).not.toBeNull();
  });

  it("returns google renderer for supported google owner", () => {
    expect(resolveProviderCardRenderer({ kind: "vendor", vendorId: "google" })).not.toBeNull();
  });

  it("normalizes vendor owner id when resolving renderer", () => {
    expect(resolveProviderCardRenderer({ kind: "vendor", vendorId: "  MiNiMaX  " })).not.toBeNull();
  });

  it("returns null for unsupported owner", () => {
    expect(resolveProviderCardRenderer({ kind: "vendor", vendorId: "openai" })).toBeNull();
  });
});
