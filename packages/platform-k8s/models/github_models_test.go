package models

import (
	"testing"

	modelv1 "code-code.internal/go-contract/model/v1"
)

func TestNormalizeGitHubModelsDefinitionsUsesAuthoritativeMetadataAndSkipsPreviewAndEmbeddings(t *testing.T) {
	t.Parallel()

	definitions := normalizeGitHubModelsDefinitions([]githubModelsCatalogModel{
		{
			ID:                        "openai/gpt-5",
			Name:                      "OpenAI gpt-5",
			SupportedInputModalities:  []string{"text", "image"},
			SupportedOutputModalities: []string{"text"},
			Capabilities:              []string{"tool-calling", "streaming", "reasoning"},
			Limits: struct {
				MaxInputTokens  int64 `json:"max_input_tokens"`
				MaxOutputTokens int64 `json:"max_output_tokens"`
			}{MaxInputTokens: 200000, MaxOutputTokens: 100000},
		},
		{
			ID:                        "openai/text-embedding-3-large",
			Name:                      "OpenAI Text Embedding 3 (large)",
			SupportedInputModalities:  []string{"text"},
			SupportedOutputModalities: []string{"embeddings"},
		},
		{
			ID:                        "openai/o1-preview",
			Name:                      "OpenAI o1-preview",
			SupportedInputModalities:  []string{"text"},
			SupportedOutputModalities: []string{"text"},
		},
		{
			ID:                        "openai/gpt-5-chat",
			Name:                      "OpenAI gpt-5-chat (preview)",
			SupportedInputModalities:  []string{"text"},
			SupportedOutputModalities: []string{"text"},
		},
		{
			ID:                        "mistral-ai/mistral-small-2503",
			Name:                      "Mistral Small 3.1",
			SupportedInputModalities:  []string{"text", "image"},
			SupportedOutputModalities: []string{"text"},
			Capabilities:              []string{"tool-calling"},
			Limits: struct {
				MaxInputTokens  int64 `json:"max_input_tokens"`
				MaxOutputTokens int64 `json:"max_output_tokens"`
			}{MaxInputTokens: 128000, MaxOutputTokens: 4096},
		},
		{
			ID:                        "deepseek/deepseek-r1-0528",
			Name:                      "DeepSeek-R1-0528",
			SupportedInputModalities:  []string{"text"},
			SupportedOutputModalities: []string{"text"},
		},
	}, testConfiguredVendorScope(map[string][]string{
		"openai":   nil,
		"mistral":  {"mistral-ai"},
		"deepseek": {"deepseek-ai"},
	}), map[string]map[string]struct{}{
		"deepseek": {"deepseek-r1": {}},
	}, "")

	if got, want := len(definitions["openai"]), 1; got != want {
		t.Fatalf("len(openai) = %d, want %d", got, want)
	}
	openai := definitions["openai"][0]
	if got, want := openai.definition.GetModelId(), "gpt-5"; got != want {
		t.Fatalf("openai model id = %q, want %q", got, want)
	}
	if got, want := openai.definition.GetContextWindowTokens(), int64(200000); got != want {
		t.Fatalf("openai context_window_tokens = %d, want %d", got, want)
	}
	if got, want := openai.definition.GetMaxOutputTokens(), int64(100000); got != want {
		t.Fatalf("openai max_output_tokens = %d, want %d", got, want)
	}
	if got, want := openai.definition.GetPrimaryShape(), modelv1.ModelShape_MODEL_SHAPE_CHAT_COMPLETIONS; got != want {
		t.Fatalf("openai primary_shape = %v, want %v", got, want)
	}
	if !hasCapability(openai.definition, modelv1.ModelCapability_MODEL_CAPABILITY_TOOL_CALLING) {
		t.Fatal("expected openai definition to keep tool calling capability")
	}
	if !hasCapability(openai.definition, modelv1.ModelCapability_MODEL_CAPABILITY_IMAGE_INPUT) {
		t.Fatal("expected openai definition to keep image input capability")
	}
	if got, want := len(openai.sources), 1; got != want {
		t.Fatalf("len(openai sources) = %d, want %d", got, want)
	}
	if got, want := openai.sources[0].aliasID, SourceIDGitHubModels; got != want {
		t.Fatalf("openai source id = %q, want %q", got, want)
	}

	mistral := definitions["mistral"][0]
	if got, want := mistral.definition.GetModelId(), "mistral-small"; got != want {
		t.Fatalf("mistral model id = %q, want %q", got, want)
	}
	if got, want := mistral.definition.GetAliases()[0].GetValue(), "mistral-small-2503"; got != want {
		t.Fatalf("mistral alias = %q, want %q", got, want)
	}

	deepseek := definitions["deepseek"][0]
	if got, want := deepseek.definition.GetModelId(), "deepseek-r1"; got != want {
		t.Fatalf("deepseek model id = %q, want %q", got, want)
	}
	if got, want := deepseek.definition.GetAliases()[0].GetValue(), "deepseek-r1-0528"; got != want {
		t.Fatalf("deepseek alias = %q, want %q", got, want)
	}
}

func TestNormalizeGitHubModelsDefinitionsIncludesGitHubProxyRowsWhenConfigured(t *testing.T) {
	t.Parallel()

	definitions := normalizeGitHubModelsDefinitions([]githubModelsCatalogModel{
		{
			ID:                        "cohere/cohere-command-a",
			Name:                      "Cohere Command A",
			SupportedInputModalities:  []string{"text"},
			SupportedOutputModalities: []string{"text"},
		},
	}, testConfiguredVendorScope(map[string][]string{
		"cohere": nil,
		"github": {"github-models"},
	}), nil, "github")

	if got, want := len(definitions["cohere"]), 1; got != want {
		t.Fatalf("len(cohere) = %d, want %d", got, want)
	}
	if got, want := len(definitions["github"]), 1; got != want {
		t.Fatalf("len(github) = %d, want %d", got, want)
	}
	proxy := definitions["github"][0]
	if got, want := proxy.definition.GetVendorId(), "github"; got != want {
		t.Fatalf("proxy vendor id = %q, want %q", got, want)
	}
	if got, want := proxy.definition.GetModelId(), "cohere/cohere-command-a"; got != want {
		t.Fatalf("proxy model id = %q, want %q", got, want)
	}
	if proxy.sourceRef == nil {
		t.Fatal("proxy sourceRef = nil")
	}
	if got, want := proxy.sourceRef.GetVendorId(), "cohere"; got != want {
		t.Fatalf("proxy sourceRef.vendorId = %q, want %q", got, want)
	}
	if got, want := proxy.sourceRef.GetModelId(), "cohere-command-a"; got != want {
		t.Fatalf("proxy sourceRef.modelId = %q, want %q", got, want)
	}
	if got, want := proxy.sources[0].sourceModelID, "cohere/cohere-command-a"; got != want {
		t.Fatalf("proxy source model id = %q, want %q", got, want)
	}
}
