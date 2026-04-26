import { describe, expect, it } from "vitest";
import type { CLI } from "@code-code/agent-contract/platform/support/v1";
import type { Vendor } from "@code-code/agent-contract/platform/support/v1";
import { findCLI, findVendor } from "./provider-capability-lookup";

function mockCLI(cliId: string): CLI {
  return { cliId } as CLI;
}

function mockVendor(vendorId: string): Vendor {
  return { vendor: { vendorId } } as Vendor;
}

describe("provider-capability-lookup", () => {
  it("finds cli with case-insensitive normalized cli id", () => {
    const clis = [mockCLI("codex")];
    expect(findCLI(clis, "  CoDeX ")).toBe(clis[0]);
  });

  it("finds vendor with case-insensitive normalized vendor id", () => {
    const vendors = [mockVendor("minimax")];
    expect(findVendor(vendors, "  MiNiMaX ")).toBe(vendors[0]);
  });

  it("returns undefined for empty normalized ids", () => {
    const clis = [mockCLI("codex")];
    const vendors = [mockVendor("minimax")];
    expect(findCLI(clis, "   ")).toBeUndefined();
    expect(findVendor(vendors, "   ")).toBeUndefined();
  });
});
