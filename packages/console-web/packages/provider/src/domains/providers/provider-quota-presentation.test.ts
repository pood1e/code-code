import { describe, expect, it } from "vitest";
import { formatQuotaAmount, formatQuotaAmountSummary } from "./provider-quota-presentation";

describe("provider-quota-presentation", () => {
  it("keeps small quota amounts readable", () => {
    expect(formatQuotaAmount(450)).toBe("450");
    expect(formatQuotaAmountSummary(450, 900)).toBe("450/900");
  });

  it("keeps values under 10000 as plain numbers", () => {
    expect(formatQuotaAmount(1500)).toBe("1,500");
    expect(formatQuotaAmount(9999)).toBe("9,999");
    expect(formatQuotaAmountSummary(1500, 5000)).toBe("1,500/5,000");
  });

  it("compacts large quota amounts consistently", () => {
    expect(formatQuotaAmount(10000)).toBe("10K");
    expect(formatQuotaAmount(14400)).toBe("14.4K");
    expect(formatQuotaAmountSummary(1400000, 2000000)).toBe("1.4M/2M");
  });

  it("handles partial quota values", () => {
    expect(formatQuotaAmountSummary(1400000, null)).toBe("1.4M");
    expect(formatQuotaAmountSummary(null, 2000000)).toBe("~/2M");
    expect(formatQuotaAmountSummary(null, null)).toBe("-");
  });
});
