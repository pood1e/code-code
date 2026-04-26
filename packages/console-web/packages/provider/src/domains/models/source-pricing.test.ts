import { describe, expect, it } from "vitest";
import { formatSourcePricing } from "./source-pricing";

describe("source pricing helpers", () => {
  it("formats input and output pricing", () => {
    expect(formatSourcePricing({
      input: "0.0000025",
      output: "0.00001",
    })).toBe("Input $2.5/M · Output $10/M");
  });

  it("returns empty string when pricing is absent", () => {
    expect(formatSourcePricing()).toBe("");
  });

  it("formats cache pricing with input labels", () => {
    expect(formatSourcePricing({
      input: "0.0000025",
      output: "0.00001",
      cacheReadInput: "0.00000025",
      cacheWriteInput: "0.000003",
    })).toBe("Input $2.5/M · Output $10/M · Cache Read $0.25/M · Cache Write $3/M");
  });
});
