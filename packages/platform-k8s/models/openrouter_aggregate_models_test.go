package models

import (
	"github.com/OpenRouterTeam/go-sdk/models/components"
	"testing"
)

func TestNormalizeOpenRouterDefinitionsIncludesAggregateVendorRoutes(t *testing.T) {
	t.Parallel()

	definitions := normalizeOpenRouterDefinitions([]components.Model{
		{
			ID:            "openai/gpt-5:free",
			CanonicalSlug: "openai/gpt-5-20250201",
			Name:          "GPT-5",
			ContextLength: 400000,
			Pricing: components.PublicPricing{
				Prompt:     "0",
				Completion: "0",
			},
			SupportedParameters: []components.Parameter{"tools"},
			Architecture: components.ModelArchitecture{
				InputModalities:  []components.InputModality{"text"},
				OutputModalities: []components.OutputModality{"text"},
			},
		},
		{
			ID:            "openai/gpt-5",
			CanonicalSlug: "openai/gpt-5-20250201",
			Name:          "GPT-5",
			ContextLength: 400000,
			Pricing: components.PublicPricing{
				Prompt:     "0.00000125",
				Completion: "0.00001",
			},
			SupportedParameters: []components.Parameter{"tools"},
			Architecture: components.ModelArchitecture{
				InputModalities:  []components.InputModality{"text"},
				OutputModalities: []components.OutputModality{"text"},
			},
		},
	}, testConfiguredVendorScope(map[string][]string{
		"openai":     nil,
		"openrouter": nil,
	}), nil, "openrouter")

	openaiDefinitions := definitions["openai"]
	if got, want := len(openaiDefinitions), 1; got != want {
		t.Fatalf("len(openai) = %d, want %d", got, want)
	}
	assertSourceBadges(t, openaiDefinitions[0], nil)

	openRouterDefinitions := definitions["openrouter"]
	if got, want := len(openRouterDefinitions), 2; got != want {
		t.Fatalf("len(openrouter) = %d, want %d", got, want)
	}
	if got, want := openRouterDefinitions[0].definition.GetModelId(), "openai/gpt-5"; got != want {
		t.Fatalf("openrouter stable model id = %q, want %q", got, want)
	}
	if got, want := openRouterDefinitions[0].sources[0].sourceModelID, "openai/gpt-5"; got != want {
		t.Fatalf("openrouter stable source model id = %q, want %q", got, want)
	}
	assertSourceBadges(t, openRouterDefinitions[0], nil)
	if got, want := openRouterDefinitions[1].definition.GetModelId(), "openai/gpt-5:free"; got != want {
		t.Fatalf("openrouter free model id = %q, want %q", got, want)
	}
	if got, want := openRouterDefinitions[1].sources[0].sourceModelID, "openai/gpt-5:free"; got != want {
		t.Fatalf("openrouter free source model id = %q, want %q", got, want)
	}
	assertSourceBadges(t, openRouterDefinitions[1], []string{SourceBadgeFree})
	assertSourcePricing(t, openRouterDefinitions[1], "0", "0")
}
