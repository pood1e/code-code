import { describe, expect, it } from "vitest";
import { buildStructuredFilter, toggleSelected } from "./model-filter";

describe("model filter helpers", () => {
  it("builds structured filters", () => {
    const filter = buildStructuredFilter(["openai", "anthropic"], "claude");
    expect(filter.vendorIds).toEqual(["openai", "anthropic"]);
    expect(filter.query).toBe("claude");
  });

  it("includes source and badge in structured filter", () => {
    const filter = buildStructuredFilter(["openai"], "gpt-5", ["nvidia-integrate"], "free");
    expect(filter.vendorIds).toEqual(["openai"]);
    expect(filter.query).toBe("gpt-5");
    expect(filter.sourceIds).toEqual(["nvidia-integrate"]);
    expect(filter.badge).toBe("free");
  });

  it("builds structured filter with lifecycle exclusion", () => {
    const filter = buildStructuredFilter([], "", [], "", "", true);
    expect(filter.lifecycleStatusExclude).toEqual(["deprecated", "eol", "blocked"]);
  });

  it("builds empty structured filter when no params", () => {
    const filter = buildStructuredFilter([], "");
    expect(filter.vendorIds?.length ?? 0).toBe(0);
    expect(filter.query).toBeFalsy();
  });

  it("toggles selections", () => {
    expect(toggleSelected(["openai"], "anthropic")).toEqual(["anthropic", "openai"]);
    expect(toggleSelected(["anthropic", "openai"], "openai")).toEqual(["anthropic"]);
  });
});
