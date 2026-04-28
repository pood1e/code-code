import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Theme } from "@radix-ui/themes";
import type { ModelRegistryEntry } from "@code-code/agent-contract/platform/model/v1";
import { ModelDetailsSources } from "./model-details-sources";

describe("ModelDetailsSources", () => {
  it("renders source callable id, pricing, and proxy label", () => {
    const row = {
      sources: [
        {
          sourceId: "nvidia-integrate",
          kind: "catalog",
          isDirect: true,
          sourceModelId: "mistral-large",
          definition: {
            vendorId: "mistral",
            modelId: "mistral-large",
            displayName: "Mistral Large",
          },
          badges: [],
          pricing: {
            input: "0.000002",
            output: "0.000006",
          },
        },
        {
          sourceId: "openrouter",
          kind: "catalog",
          isDirect: false,
          sourceModelId: "mistralai/mistral-large",
          definition: {
            vendorId: "openrouter",
            modelId: "mistralai/mistral-large",
          },
          badges: ["proxy"],
          pricing: {
            input: "0.000003",
          },
        },
      ],
    } as ModelRegistryEntry;

    render(
      <Theme>
        <ModelDetailsSources
          row={row}
          vendorsById={{
            mistral: {
              vendorId: "mistral",
              displayName: "Mistral AI",
              aliases: ["mistralai"],
            },
          }}
        />
      </Theme>
    );

    expect(screen.getByText("Mistral AI")).toBeInTheDocument();
    expect(screen.getByText("nvidia-integrate")).toBeInTheDocument();
    expect(screen.getByText("mistral-large")).toBeInTheDocument();
    expect(screen.getByText(/Input: \$2\/M/)).toBeInTheDocument();
    expect(screen.getAllByText("openrouter")).toHaveLength(2);
    expect(screen.getByText("mistralai/mistral-large")).toBeInTheDocument();
    expect(screen.getByText("Proxy")).toBeInTheDocument();
  });
});
