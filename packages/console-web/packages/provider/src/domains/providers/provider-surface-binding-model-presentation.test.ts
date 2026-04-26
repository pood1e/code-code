import { create } from "@bufbuild/protobuf";
import { ProviderModelCatalogEntrySchema } from "@code-code/agent-contract/provider/v1";
import { describe, expect, it } from "vitest";
import { describeProviderModelCatalogEntry } from "./provider-surface-binding-model-presentation";

describe("provider-surface-binding-model-presentation", () => {
  it("prefers canonical model id for labels when model ref differs", () => {
    const presentation = describeProviderModelCatalogEntry(create(ProviderModelCatalogEntrySchema, {
      providerModelId: "chat_20706",
      modelRef: {
        vendorId: "google",
        modelId: "gemini-2.5-pro",
      },
    }));

    expect(presentation.label).toBe("gemini-2.5-pro");
    expect(presentation.detail).toBe("Provider ID: chat_20706");
  });
});
