package models

import "testing"

func TestNormalizeDefinitionSourcesOrdersByAuthorityPriority(t *testing.T) {
	t.Parallel()

	sources := normalizeDefinitionSources([]definitionSource{
		{vendorID: "openai", modelID: "gpt-5", aliasID: SourceIDOpenRouter},
		{vendorID: "openai", modelID: "gpt-5", aliasID: SourceIDHuggingFaceHub},
		{vendorID: "openai", modelID: "gpt-5", aliasID: SourceIDGitHubModels, isDirect: true},
	})

	if got, want := sources[0].aliasID, SourceIDGitHubModels; got != want {
		t.Fatalf("sources[0] = %q, want %q", got, want)
	}
	if got, want := sources[1].aliasID, SourceIDHuggingFaceHub; got != want {
		t.Fatalf("sources[1] = %q, want %q", got, want)
	}
	if got, want := sources[2].aliasID, SourceIDOpenRouter; got != want {
		t.Fatalf("sources[2] = %q, want %q", got, want)
	}
}
