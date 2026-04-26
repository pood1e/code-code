import { describe, expect, it } from "vitest";
import { buildDirectFilter, buildFilter, buildRelatedBatchFilter, toggleSelected } from "./model-filter";

describe("model filter helpers", () => {
  it("builds multi-value filters", () => {
    expect(buildFilter(["openai", "anthropic"], "claude"))
      .toBe("model_id_query=claude AND vendor_id=openai,anthropic");
  });

  it("appends source filters", () => {
    expect(buildFilter(["openai"], "gpt-5", ["nvidia-integrate", "openrouter"]))
      .toBe("model_id_query=gpt-5 AND vendor_id=openai AND source_id=nvidia-integrate,openrouter");
  });

  it("appends badge filters", () => {
    expect(buildFilter(["openai"], "gpt-5", [], "free"))
      .toBe("model_id_query=gpt-5 AND vendor_id=openai AND badge=free");
  });

  it("builds direct-model filters", () => {
    expect(buildDirectFilter(["openai"], "gpt-5", ["nvidia-integrate"]))
      .toBe("source_ref=null AND model_id_query=gpt-5 AND vendor_id=openai AND source_id=nvidia-integrate");
    expect(buildDirectFilter(["openai"], "gpt-5", ["nvidia-integrate"], "free"))
      .toBe("source_ref=null AND model_id_query=gpt-5 AND vendor_id=openai AND source_id=nvidia-integrate AND badge=free");
  });

  it("builds one batch proxy filter for multiple source refs", () => {
    expect(buildRelatedBatchFilter([
      { vendorId: "openai", modelId: "gpt-5" },
      { vendorId: "anthropic", modelId: "claude-sonnet-4" },
      { vendorId: "openai", modelId: "gpt-5" },
    ])).toBe("source_vendor_id=openai,anthropic AND source_model_id=gpt-5,claude-sonnet-4");
  });

  it("omits optional clauses when filters are empty", () => {
    expect(buildFilter([], "")).toBe("");
    expect(buildRelatedBatchFilter([])).toBe("");
  });

  it("toggles selections", () => {
    expect(toggleSelected(["openai"], "anthropic")).toEqual(["anthropic", "openai"]);
    expect(toggleSelected(["anthropic", "openai"], "openai")).toEqual(["anthropic"]);
  });
});
