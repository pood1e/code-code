import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Theme } from "@radix-ui/themes";
import { afterEach, describe, expect, it } from "vitest";
import { ModelCapability, ModelShape, Modality } from "@code-code/agent-contract/model/v1";
import type { ModelRegistryEntry } from "@code-code/agent-contract/platform/model/v1";
import { ModelCardList } from "./model-card-list";

describe("ModelCardList", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders model cards with model information", () => {
    const model = {
      definition: {
        vendorId: "cohere",
        modelId: "cohere-command-r",
        displayName: "Cohere Command R",
        capabilities: [ModelCapability.TOOL_CALLING],
        contextSpec: { maxContextTokens: 128000n },
        primaryShape: ModelShape.CHAT_COMPLETIONS,
        inputModalities: [Modality.TEXT],
        outputModalities: [Modality.TEXT],
      },
      badges: [],
      pricing: { input: "0.000001", output: "0.000002" },
      sources: [{
        sourceId: "github-models",
        isDirect: true,
        sourceModelId: "cohere/command-r-08-2024",
        kind: "preset",
        badges: [],
      }],
    } as ModelRegistryEntry;

    render(
      <Theme>
        <ModelCardList
          models={[model]}
          selectedSourceIds={[]}
          vendorsById={{
            cohere: { vendorId: "cohere", displayName: "Cohere", aliases: [] },
          }}
        />
      </Theme>
    );

    expect(screen.getByText("Cohere Command R")).toBeInTheDocument();
    expect(screen.getByText("cohere-command-r")).toBeInTheDocument();
    expect(screen.getByText("Cohere")).toBeInTheDocument();
    expect(screen.getByText("Chat Completions")).toBeInTheDocument();
  });

  it("opens model details dialog when a card is clicked", () => {
    const model = {
      definition: {
        vendorId: "cohere",
        modelId: "cohere-command-r",
        displayName: "Cohere Command R",
        capabilities: [],
        aliases: [],
        supportedShapes: [],
        inputModalities: [],
        outputModalities: [],
      },
      badges: [],
      sources: [],
    } as ModelRegistryEntry;

    render(
      <Theme>
        <ModelCardList
          models={[model]}
          selectedSourceIds={[]}
          vendorsById={{
            cohere: { vendorId: "cohere", displayName: "Cohere", aliases: [] },
          }}
        />
      </Theme>
    );

    fireEvent.click(screen.getByRole("button", { name: /open details for cohere command r/i }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/canonical model metadata/i)).toBeInTheDocument();
  });

  it("highlights matched source filter badges on cards", () => {
    const model = {
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
    } as ModelRegistryEntry;

    render(
      <Theme>
        <ModelCardList
          models={[model]}
          selectedSourceIds={["github-models"]}
          vendorsById={{}}
        />
      </Theme>
    );

    expect(screen.getByText("GitHub Models")).toBeInTheDocument();
  });

  it("shows an empty state when no models are present", () => {
    render(
      <Theme>
        <ModelCardList
          models={[]}
          selectedSourceIds={[]}
          vendorsById={{}}
        />
      </Theme>
    );

    expect(screen.getByText("No models found.")).toBeInTheDocument();
  });
});
