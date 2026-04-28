import { render, screen } from "@testing-library/react";
import { Theme } from "@radix-ui/themes";
import { describe, expect, it } from "vitest";
import type { ModelRegistryEntry } from "@code-code/agent-contract/platform/model/v1";
import { ModelsTable } from "./models-table";

describe("ModelsTable", () => {
  it("shows matched source labels when a source filter is active", () => {
    const models = [{
      definition: {
        vendorId: "cohere",
        modelId: "cohere-command-r",
        displayName: "Cohere Command R",
        capabilities: [],
      },
      badges: [],
      sources: [{
        sourceId: "github-models",
        isDirect: true,
        sourceModelId: "cohere/command-r-08-2024",
        kind: "preset",
        badges: [],
      }],
    }] as ModelRegistryEntry[];

    render(
      <Theme>
        <ModelsTable
          models={models}
          vendorsById={{}}
          selectedSourceIds={["github-models"]}
        />
      </Theme>
    );

    expect(screen.getByText("GitHub Models")).toBeInTheDocument();
  });
});
