package models

import (
	"testing"

	modelv1 "code-code.internal/go-contract/model/v1"
)

func TestNormalizeHuggingFaceDefinitionsFiltersQuantizedArtifactsAndMapsStableFamilies(t *testing.T) {
	t.Parallel()

	definitions := normalizeHuggingFaceDefinitions([]huggingFaceModel{
		{ModelID: "Qwen/Qwen3-235B-A22B-Instruct-2507", PipelineTag: "text-generation"},
		{ModelID: "mistralai/Devstral-Small-2507_gguf", PipelineTag: "text-generation", Tags: []string{"gguf"}},
		{ModelID: "deepseek-ai/DeepSeek-R1-0528", PipelineTag: "text-generation"},
		{ModelID: "Qwen/Qwen3-Embedding-8B", PipelineTag: "feature-extraction"},
	}, testConfiguredVendorScope(map[string][]string{
		"qwen":     nil,
		"deepseek": {"deepseek-ai"},
		"mistral":  {"mistralai"},
	}), map[string]map[string]struct{}{
		"qwen": {
			"qwen3-235b-a22b": {},
		},
		"deepseek": {
			"deepseek-r1": {},
		},
	})

	if got, want := definitions["qwen"][0].definition.GetModelId(), "qwen3-235b-a22b"; got != want {
		t.Fatalf("qwen model id = %q, want %q", got, want)
	}
	assertAlias(t, definitions["qwen"][0].definition, modelv1.AliasKind_ALIAS_KIND_SNAPSHOT, "qwen3-235b-a22b-instruct-2507")
	if got, want := definitions["deepseek"][0].definition.GetModelId(), "deepseek-r1"; got != want {
		t.Fatalf("deepseek model id = %q, want %q", got, want)
	}
	if got := len(definitions["mistral"]); got != 0 {
		t.Fatalf("len(mistral) = %d, want 0", got)
	}
	if got, want := definitions["deepseek"][0].sources[0].aliasID, SourceIDHuggingFaceHub; got != want {
		t.Fatalf("source id = %q, want %q", got, want)
	}
}

func TestHuggingFaceAuthorCandidatesIncludesOfficialAliases(t *testing.T) {
	t.Parallel()

	candidates := huggingFaceAuthorCandidates("mistral", testConfiguredVendorScope(map[string][]string{
		"mistral": {"mistralai"},
	}))
	if !containsString(candidates, "mistralai") {
		t.Fatalf("mistral candidates = %#v, want mistralai", candidates)
	}
	if !containsString(candidates, "Mistral") {
		t.Fatalf("mistral candidates = %#v, want Mistral", candidates)
	}
}

func containsString(values []string, target string) bool {
	for _, value := range values {
		if value == target {
			return true
		}
	}
	return false
}
