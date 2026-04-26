package models

import "testing"

func TestNormalizeNVIDIADefinitionsFiltersUtilityModelsAndKeepsVendorScopedFamilies(t *testing.T) {
	t.Parallel()

	definitions := normalizeNVIDIADefinitions([]nvidiaModel{
		{ID: "nvidia/llama-3.1-nemotron-70b-instruct", OwnedBy: "nvidia"},
		{ID: "nvidia/embed-qa-4", OwnedBy: "nvidia"},
		{ID: "openai/gpt-oss-120b", OwnedBy: "openai"},
		{ID: "mistralai/mistral-large-2411", OwnedBy: "mistralai"},
	}, testConfiguredVendorScope(map[string][]string{
		"nvidia":  nil,
		"openai":  nil,
		"mistral": {"mistralai"},
	}), map[string]map[string]struct{}{
		"mistral": {
			"mistral-large": {},
		},
	})

	if got, want := len(definitions["nvidia"]), 1; got != want {
		t.Fatalf("len(nvidia) = %d, want %d", got, want)
	}
	if got, want := definitions["nvidia"][0].definition.GetModelId(), "llama-3.1-nemotron-70b-instruct"; got != want {
		t.Fatalf("nvidia model id = %q, want %q", got, want)
	}
	if got, want := definitions["openai"][0].definition.GetModelId(), "gpt-oss-120b"; got != want {
		t.Fatalf("openai model id = %q, want %q", got, want)
	}
	if got, want := definitions["mistral"][0].definition.GetModelId(), "mistral-large"; got != want {
		t.Fatalf("mistral model id = %q, want %q", got, want)
	}
	if got, want := definitions["mistral"][0].sources[0].aliasID, SourceIDNVIDIAIntegrate; got != want {
		t.Fatalf("source id = %q, want %q", got, want)
	}
}
