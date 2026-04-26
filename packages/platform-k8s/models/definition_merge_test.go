package models

import (
	"testing"

	modelv1 "code-code.internal/go-contract/model/v1"
)

func TestMergeCollectedDefinitionsPrefersHigherAuthorityMetadata(t *testing.T) {
	t.Parallel()

	merged := mergeCollectedDefinitions(
		collectedDefinition{
			definition: &modelv1.ModelDefinition{
				ModelId:             "gpt-5",
				DisplayName:         "GPT 5",
				VendorId:            "openai",
				ContextWindowTokens: 128000,
			},
			sources: []definitionSource{{vendorID: "openai", modelID: "gpt-5", aliasID: SourceIDOpenRouter}},
		},
		collectedDefinition{
			definition: &modelv1.ModelDefinition{
				ModelId:             "gpt-5",
				DisplayName:         "OpenAI GPT-5",
				VendorId:            "openai",
				ContextWindowTokens: 200000,
				MaxOutputTokens:     100000,
			},
			sources: []definitionSource{{vendorID: "openai", modelID: "gpt-5", aliasID: SourceIDGitHubModels, isDirect: true}},
		},
	)

	if got, want := merged.definition.GetDisplayName(), "OpenAI GPT-5"; got != want {
		t.Fatalf("display_name = %q, want %q", got, want)
	}
	if got, want := merged.definition.GetContextWindowTokens(), int64(200000); got != want {
		t.Fatalf("context_window_tokens = %d, want %d", got, want)
	}
	if got, want := merged.definition.GetMaxOutputTokens(), int64(100000); got != want {
		t.Fatalf("max_output_tokens = %d, want %d", got, want)
	}
	if got, want := merged.sources[0].aliasID, SourceIDGitHubModels; got != want {
		t.Fatalf("primary source = %q, want %q", got, want)
	}
}
