package models

import (
	"github.com/OpenRouterTeam/go-sdk"
	"github.com/OpenRouterTeam/go-sdk/models/components"
	"testing"

	modelv1 "code-code.internal/go-contract/model/v1"
)

func TestNormalizeOpenRouterDefinitionsMapsStableIDsAndSnapshotAliases(t *testing.T) {
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
			SupportedParameters: []components.Parameter{components.Parameter("tools"), components.Parameter("response_format")},
			Architecture: components.ModelArchitecture{
				InputModalities:  []components.InputModality{components.InputModality("text"), components.InputModality("image")},
				OutputModalities: []components.OutputModality{components.OutputModality("text")},
			},
			TopProvider: components.TopProviderInfo{MaxCompletionTokens: openrouter.Int64(16000)},
		},
		{
			ID:            "openai/gpt-4o",
			CanonicalSlug: "openai/gpt-4o",
			Name:          "OpenAI: GPT-4o",
			ContextLength: 128000,
			Pricing: components.PublicPricing{
				Prompt:     "0.0000025",
				Completion: "0.00001",
			},
			SupportedParameters: []components.Parameter{components.Parameter("tools")},
			Architecture: components.ModelArchitecture{
				InputModalities:  []components.InputModality{components.InputModality("text")},
				OutputModalities: []components.OutputModality{components.OutputModality("text")},
			},
			TopProvider: components.TopProviderInfo{MaxCompletionTokens: openrouter.Int64(16384)},
		},
		{
			ID:            "openai/gpt-4o:extended",
			CanonicalSlug: "openai/gpt-4o",
			Name:          "OpenAI: GPT-4o (extended)",
			ContextLength: 128000,
			Pricing: components.PublicPricing{
				Prompt:     "0.000003",
				Completion: "0.000012",
			},
			SupportedParameters: []components.Parameter{components.Parameter("response_format"), components.Parameter("tools")},
			Architecture: components.ModelArchitecture{
				InputModalities:  []components.InputModality{components.InputModality("text")},
				OutputModalities: []components.OutputModality{components.OutputModality("text")},
			},
			TopProvider: components.TopProviderInfo{MaxCompletionTokens: openrouter.Int64(64000)},
		},
		{
			ID:            "mistralai/mistral-medium-3",
			CanonicalSlug: "mistralai/mistral-medium-3",
			Name:          "Mistral Medium 3",
			Pricing: components.PublicPricing{
				Prompt:     "0.0000004",
				Completion: "0.000002",
			},
		},
		{
			ID:            "moonshotai/kimi-k2:thinking",
			CanonicalSlug: "moonshotai/kimi-k2-20250201",
			Name:          "Kimi K2",
			Pricing: components.PublicPricing{
				Prompt:     "0.000001",
				Completion: "0.000004",
			},
		},
		{
			ID:            "google/gemma-4-26b-a4b-it",
			CanonicalSlug: "google/gemma-4-26b-a4b-it-20260403",
			Name:          "Google: Gemma 4 26B A4B",
		},
		{
			ID:            "google/gemma-4-26b-a4b-it:free",
			CanonicalSlug: "google/gemma-4-26b-a4b-it-20260403",
			Name:          "Google: Gemma 4 26B A4B (free)",
			ContextLength: 262144,
			TopProvider:   components.TopProviderInfo{MaxCompletionTokens: openrouter.Int64(32768)},
		},
		{
			ID:   "unknown/foo",
			Name: "Ignored",
		},
	}, testConfiguredVendorScope(map[string][]string{
		"openai":   nil,
		"google":   nil,
		"mistral":  {"mistralai"},
		"moonshot": {"moonshotai"},
	}), nil, "")

	openai := definitions["openai"]
	if got, want := len(openai), 2; got != want {
		t.Fatalf("len(openai) = %d, want %d", got, want)
	}
	if got, want := openai[0].definition.GetModelId(), "gpt-4o"; got != want {
		t.Fatalf("openai model id = %q, want %q", got, want)
	}
	if got, want := openai[0].definition.GetMaxOutputTokens(), int64(16384); got != want {
		t.Fatalf("gpt-4o max output tokens = %d, want %d", got, want)
	}
	assertSourceBadges(t, openai[0], nil)
	assertSourcePricing(t, openai[0], "0.0000025", "0.00001")
	if got, want := openai[1].definition.GetModelId(), "gpt-5"; got != want {
		t.Fatalf("openai canonical model id = %q, want %q", got, want)
	}
	if got, want := openai[1].definition.GetVendorId(), "openai"; got != want {
		t.Fatalf("openai vendor id = %q, want %q", got, want)
	}
	if got, want := openai[1].sources[0].sourceModelID, "openai/gpt-5:free"; got != want {
		t.Fatalf("openai source model id = %q, want %q", got, want)
	}
	if got, want := openai[1].definition.GetContextWindowTokens(), int64(400000); got != want {
		t.Fatalf("context window = %d, want %d", got, want)
	}
	if got, want := openai[1].definition.GetMaxOutputTokens(), int64(16000); got != want {
		t.Fatalf("max output tokens = %d, want %d", got, want)
	}
	if !hasCapability(openai[1].definition, modelv1.ModelCapability_MODEL_CAPABILITY_TOOL_CALLING) {
		t.Fatal("expected tool calling capability")
	}
	if !hasCapability(openai[1].definition, modelv1.ModelCapability_MODEL_CAPABILITY_STRUCTURED_OUTPUT) {
		t.Fatal("expected structured output capability")
	}
	if !hasCapability(openai[1].definition, modelv1.ModelCapability_MODEL_CAPABILITY_IMAGE_INPUT) {
		t.Fatal("expected image input capability")
	}
	assertAlias(t, openai[1].definition, modelv1.AliasKind_ALIAS_KIND_SNAPSHOT, "gpt-5-20250201")
	assertSourceBadges(t, openai[1], nil)
	assertSourcePricing(t, openai[1], "0", "0")

	if got, want := definitions["mistral"][0].definition.GetVendorId(), "mistral"; got != want {
		t.Fatalf("mistral vendor id = %q, want %q", got, want)
	}
	if got, want := definitions["mistral"][0].sources[0].vendorID, "mistral"; got != want {
		t.Fatalf("mistral source vendor id = %q, want %q", got, want)
	}
	if got, want := definitions["mistral"][0].sources[0].sourceModelID, "mistralai/mistral-medium-3"; got != want {
		t.Fatalf("mistral source model id = %q, want %q", got, want)
	}
	if got, want := definitions["moonshot"][0].definition.GetModelId(), "kimi-k2"; got != want {
		t.Fatalf("moonshot model id = %q, want %q", got, want)
	}
	assertAlias(t, definitions["moonshot"][0].definition, modelv1.AliasKind_ALIAS_KIND_SNAPSHOT, "kimi-k2-20250201")
	if got, want := definitions["google"][0].definition.GetModelId(), "gemma-4-26b-a4b-it"; got != want {
		t.Fatalf("google model id = %q, want %q", got, want)
	}
	if got, want := definitions["google"][0].definition.GetMaxOutputTokens(), int64(32768); got != want {
		t.Fatalf("google max output tokens = %d, want %d", got, want)
	}
	assertAlias(t, definitions["google"][0].definition, modelv1.AliasKind_ALIAS_KIND_SNAPSHOT, "gemma-4-26b-a4b-it-20260403")
	assertSourceBadges(t, definitions["google"][0], nil)
	if _, ok := definitions["unknown"]; ok {
		t.Fatal("unexpected unknown vendor definitions")
	}
}

func TestNormalizeOpenRouterDefinitionsSkipsPreviewAndAddsAnthropicSnapshotAlias(t *testing.T) {
	t.Parallel()

	definitions := normalizeOpenRouterDefinitions([]components.Model{
		{
			ID:            "anthropic/claude-sonnet-4.5",
			CanonicalSlug: "anthropic/claude-4.5-sonnet-20250929",
			Name:          "Claude Sonnet 4.5",
		},
		{
			ID:            "google/gemini-2.5-pro-preview",
			CanonicalSlug: "google/gemini-2.5-pro-preview-06-05",
			Name:          "Gemini 2.5 Pro Preview",
		},
		{
			ID:            "openai/gpt-4o-audio-preview",
			CanonicalSlug: "openai/gpt-4o-audio-preview",
			Name:          "GPT-4o Audio Preview",
		},
	}, testConfiguredVendorScope(map[string][]string{
		"anthropic": nil,
		"google":    nil,
		"openai":    nil,
	}), nil, "")

	if got, want := len(definitions["anthropic"]), 1; got != want {
		t.Fatalf("len(anthropic) = %d, want %d", got, want)
	}
	if got, want := definitions["anthropic"][0].definition.GetModelId(), "claude-sonnet-4.5"; got != want {
		t.Fatalf("anthropic model id = %q, want %q", got, want)
	}
	assertAlias(t, definitions["anthropic"][0].definition, modelv1.AliasKind_ALIAS_KIND_SNAPSHOT, "claude-4.5-sonnet-20250929")
	if _, ok := definitions["google"]; ok {
		t.Fatal("unexpected preview google definitions")
	}
	if _, ok := definitions["openai"]; ok {
		t.Fatal("unexpected preview openai definitions")
	}
}

func TestNormalizeOpenRouterDefinitionsNormalizesMonthYearFamilies(t *testing.T) {
	t.Parallel()

	definitions := normalizeOpenRouterDefinitions([]components.Model{
		{
			ID:            "cohere/command-r-08-2024",
			CanonicalSlug: "cohere/command-r-08-2024",
			Name:          "Cohere: Command R (08-2024)",
		},
		{
			ID:            "cohere/command-r-plus-08-2024",
			CanonicalSlug: "cohere/command-r-plus-08-2024",
			Name:          "Cohere: Command R+ (08-2024)",
		},
	}, testConfiguredVendorScope(map[string][]string{
		"cohere": nil,
	}), nil, "")

	if got, want := definitions["cohere"][0].definition.GetModelId(), "command-r"; got != want {
		t.Fatalf("cohere command-r model id = %q, want %q", got, want)
	}
	assertAlias(t, definitions["cohere"][0].definition, modelv1.AliasKind_ALIAS_KIND_SNAPSHOT, "command-r-08-2024")
	if got, want := definitions["cohere"][1].definition.GetModelId(), "command-r-plus"; got != want {
		t.Fatalf("cohere command-r-plus model id = %q, want %q", got, want)
	}
	assertAlias(t, definitions["cohere"][1].definition, modelv1.AliasKind_ALIAS_KIND_SNAPSHOT, "command-r-plus-08-2024")
}

func hasCapability(definition *modelv1.ModelDefinition, target modelv1.ModelCapability) bool {
	for _, capability := range definition.GetCapabilities() {
		if capability == target {
			return true
		}
	}
	return false
}

func assertAlias(t *testing.T, definition *modelv1.ModelDefinition, kind modelv1.AliasKind, value string) {
	t.Helper()
	for _, alias := range definition.GetAliases() {
		if alias.GetKind() == kind && alias.GetValue() == value {
			return
		}
	}
	t.Fatalf("alias %s:%q not found", kind.String(), value)
}

func assertSourceBadges(t *testing.T, definition collectedDefinition, want []string) {
	t.Helper()
	if !equalStrings(definition.badges, want) {
		t.Fatalf("badges = %#v, want %#v", definition.badges, want)
	}
}

func assertSourcePricing(t *testing.T, definition collectedDefinition, prompt string, completion string) {
	t.Helper()
	if definition.pricing == nil {
		t.Fatal("pricing = nil")
	}
	if got := definition.pricing.Input; got != prompt {
		t.Fatalf("input pricing = %q, want %q", got, prompt)
	}
	if got := definition.pricing.Output; got != completion {
		t.Fatalf("output pricing = %q, want %q", got, completion)
	}
}
