import { describe, expect, it } from "vitest";
import { buildVendorIndex, vendorLookupKey } from "./vendor-index";

describe("vendor index", () => {
  it("indexes vendors by vendor id and aliases", () => {
    const index = buildVendorIndex([
      {
        vendorId: "mistral",
        displayName: "Mistral AI",
        aliases: ["mistralai"],
      },
    ] as never[]);

    expect(index[vendorLookupKey("mistral")]?.displayName).toBe("Mistral AI");
    expect(index[vendorLookupKey("mistralai")]?.displayName).toBe("Mistral AI");
  });
});
