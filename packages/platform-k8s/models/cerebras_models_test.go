package models

import (
	"testing"

	modelv1 "code-code.internal/go-contract/model/v1"
)

func TestNormalizeCerebrasDefinitionsUsesHuggingFaceIdentityAndPricing(t *testing.T) {
	t.Parallel()

	definitions := normalizeCerebrasDefinitions([]cerebrasModel{{
		ID:            "qwen-3-235b-a22b-instruct-2507",
		OwnedBy:       "Qwen",
		Name:          "Qwen 3 235B Instruct",
		HuggingFaceID: "Qwen/Qwen3-235B-A22B-Instruct-2507",
		Pricing: struct {
			Prompt     string `json:"prompt"`
			Completion string `json:"completion"`
		}{
			Prompt:     "0.0000006",
			Completion: "0.0000012",
		},
	}}, testConfiguredVendorScope(map[string][]string{
		"qwen": nil,
	}), map[string]map[string]struct{}{
		"qwen": {
			"qwen3-235b-a22b": {},
		},
	}, "")

	if got, want := definitions["qwen"][0].definition.GetModelId(), "qwen3-235b-a22b"; got != want {
		t.Fatalf("qwen model id = %q, want %q", got, want)
	}
	assertAlias(t, definitions["qwen"][0].definition, modelv1.AliasKind_ALIAS_KIND_SNAPSHOT, "qwen3-235b-a22b-instruct-2507")
	if got, want := definitions["qwen"][0].sources[0].pricing.Input, "0.0000006"; got != want {
		t.Fatalf("prompt pricing = %q, want %q", got, want)
	}
	if got, want := definitions["qwen"][0].sources[0].aliasID, SourceIDCerebras; got != want {
		t.Fatalf("source id = %q, want %q", got, want)
	}
	if got, want := definitions["qwen"][0].sources[0].sourceModelID, "qwen-3-235b-a22b-instruct-2507"; got != want {
		t.Fatalf("source model id = %q, want %q", got, want)
	}
}

func TestNormalizeCerebrasDefinitionsIncludesCerebrasProxyRows(t *testing.T) {
	t.Parallel()

	definitions := normalizeCerebrasDefinitions([]cerebrasModel{{
		ID:      "gpt-oss-120b",
		OwnedBy: "openai",
		Name:    "GPT OSS 120B",
	}}, testConfiguredVendorScope(map[string][]string{
		"openai":   nil,
		"cerebras": nil,
	}), nil, "cerebras")

	if got, want := len(definitions["openai"]), 1; got != want {
		t.Fatalf("len(openai) = %d, want %d", got, want)
	}
	if got, want := len(definitions["cerebras"]), 1; got != want {
		t.Fatalf("len(cerebras) = %d, want %d", got, want)
	}
	proxy := definitions["cerebras"][0]
	if got, want := proxy.definition.GetModelId(), "gpt-oss-120b"; got != want {
		t.Fatalf("proxy model id = %q, want %q", got, want)
	}
	if proxy.sourceRef == nil {
		t.Fatal("proxy sourceRef = nil")
	}
	if got, want := proxy.sourceRef.GetVendorId(), "openai"; got != want {
		t.Fatalf("proxy sourceRef.vendorId = %q, want %q", got, want)
	}
	if got, want := proxy.sourceRef.GetModelId(), "gpt-oss-120b"; got != want {
		t.Fatalf("proxy sourceRef.modelId = %q, want %q", got, want)
	}
	if got, want := proxy.sources[0].sourceModelID, "gpt-oss-120b"; got != want {
		t.Fatalf("proxy source model id = %q, want %q", got, want)
	}
}
