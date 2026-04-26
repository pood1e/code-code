package models

import (
	"context"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"code-code.internal/platform-k8s/internal/testutil"
	ctrlclient "sigs.k8s.io/controller-runtime/pkg/client"
	ctrlclientfake "sigs.k8s.io/controller-runtime/pkg/client/fake"
)

func TestDefinitionSyncReconcilerCollectsAuthoritativeDefinitionsFromOpenRouter(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if got, want := r.URL.Path, "/models"; got != want {
			t.Fatalf("path = %q, want %q", got, want)
		}
		_, _ = w.Write([]byte(`{"data":[
			{"id":"openai/gpt-5:free","canonical_slug":"openai/gpt-5-20250201","name":"GPT-5","context_length":400000,"pricing":{"prompt":"0","completion":"0"},"supported_parameters":["tools"],"architecture":{"input_modalities":["text"],"output_modalities":["text"]},"top_provider":{"max_completion_tokens":16000}},
			{"id":"mistralai/mistral-medium-3","canonical_slug":"mistralai/mistral-medium-3","name":"Mistral Medium 3","context_length":128000,"architecture":{"input_modalities":["text"],"output_modalities":["text"]},"top_provider":{"max_completion_tokens":8000}}
		]}`))
	}))
	defer server.Close()

	client := ctrlclientfake.NewClientBuilder().
		WithScheme(testutil.NewScheme()).
		Build()

	reconciler := newCollectionTestReconciler(client, map[string]string{
		SourceIDGitHubModels:    "://bad-url",
		SourceIDOpenRouter:      server.URL + "/models",
		SourceIDModelScope:      "://bad-url",
		SourceIDCerebras:        "://bad-url",
		SourceIDNVIDIAIntegrate: "://bad-url",
		SourceIDHuggingFaceHub:  "://bad-url",
	})

	snapshot, err := reconciler.collectAuthoritativeDefinitions(context.Background())
	if err != nil {
		t.Fatalf("collectAuthoritativeDefinitions() error = %v", err)
	}

	if got, want := len(snapshot.definitions), 4; got != want {
		t.Fatalf("len(definitions) = %d, want %d", got, want)
	}
	openaiDefinition := snapshot.definitions[identityKey("openai", "gpt-5")]
	if got, want := openaiDefinition.definition.GetVendorId(), "openai"; got != want {
		t.Fatalf("openai vendor id = %q, want %q", got, want)
	}
	if got, want := openaiDefinition.definition.GetAliases()[0].GetValue(), "gpt-5-20250201"; got != want {
		t.Fatalf("openai snapshot alias = %q, want %q", got, want)
	}
	if got := len(openaiDefinition.sources); got == 0 {
		t.Fatal("sources = 0, want at least 1")
	}
	if got, want := openaiDefinition.sources[0].aliasID, SourceIDOpenRouter; got != want {
		t.Fatalf("source id = %q, want %q", got, want)
	}
	if !equalStrings(openaiDefinition.sources[0].badges, nil) {
		t.Fatalf("source badges = %#v, want none", openaiDefinition.sources[0].badges)
	}
	if openaiDefinition.pricing == nil {
		t.Fatal("openai pricing = nil")
	}
	if got, want := openaiDefinition.pricing.Input, "0"; got != want {
		t.Fatalf("openai input pricing = %q, want %q", got, want)
	}
	if got, want := snapshot.definitions[identityKey("mistral", "mistral-medium-3")].definition.GetModelId(), "mistral-medium-3"; got != want {
		t.Fatalf("mistral model id = %q, want %q", got, want)
	}
	openRouterDefinition := snapshot.definitions[identityKey("openrouter", "openai/gpt-5:free")]
	if got, want := openRouterDefinition.definition.GetVendorId(), "openrouter"; got != want {
		t.Fatalf("openrouter vendor id = %q, want %q", got, want)
	}
	if got, want := openRouterDefinition.definition.GetModelId(), "openai/gpt-5:free"; got != want {
		t.Fatalf("openrouter model id = %q, want %q", got, want)
	}
	if !equalStrings(openRouterDefinition.sources[0].badges, []string{SourceBadgeFree}) {
		t.Fatalf("openrouter source badges = %#v, want %#v", openRouterDefinition.sources[0].badges, []string{SourceBadgeFree})
	}
	if got, want := openRouterDefinition.sourceRef.GetVendorId(), "openai"; got != want {
		t.Fatalf("openrouter source vendor id = %q, want %q", got, want)
	}
	if got, want := openRouterDefinition.sourceRef.GetModelId(), "gpt-5"; got != want {
		t.Fatalf("openrouter source model id = %q, want %q", got, want)
	}

}

func TestDefinitionSyncReconcilerPrefersGitHubModelsMetadataAndKeepsOpenRouterPricing(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/github":
			_, _ = w.Write([]byte(`[
				{"id":"openai/gpt-5","name":"OpenAI gpt-5","supported_input_modalities":["text","image"],"supported_output_modalities":["text"],"capabilities":["tool-calling","streaming"],"limits":{"max_input_tokens":200000,"max_output_tokens":100000}}
			]`))
		case "/openrouter/models":
			_, _ = w.Write([]byte(`{"data":[
				{"id":"openai/gpt-5","canonical_slug":"openai/gpt-5-2025-08-07","name":"GPT-5","context_length":400000,"pricing":{"prompt":"0.00000125","completion":"0.00001"},"supported_parameters":["tools"],"architecture":{"input_modalities":["text"],"output_modalities":["text"]},"top_provider":{"max_completion_tokens":16000}}
			]}`))
		default:
			t.Fatalf("unexpected path %q", r.URL.Path)
		}
	}))
	defer server.Close()

	client := ctrlclientfake.NewClientBuilder().
		WithScheme(testutil.NewScheme()).
		Build()

	reconciler := newCollectionTestReconciler(client, map[string]string{
		SourceIDGitHubModels:    server.URL + "/github",
		SourceIDOpenRouter:      server.URL + "/openrouter",
		SourceIDModelScope:      "://bad-url",
		SourceIDCerebras:        "://bad-url",
		SourceIDNVIDIAIntegrate: "://bad-url",
		SourceIDHuggingFaceHub:  "://bad-url",
	})

	snapshot, err := reconciler.collectAuthoritativeDefinitions(context.Background())
	if err != nil {
		t.Fatalf("collectAuthoritativeDefinitions() error = %v", err)
	}

	definition := snapshot.definitions[identityKey("openai", "gpt-5")]
	if got, want := definition.definition.GetContextWindowTokens(), int64(200000); got != want {
		t.Fatalf("context_window_tokens = %d, want %d", got, want)
	}
	if got, want := definition.definition.GetMaxOutputTokens(), int64(100000); got != want {
		t.Fatalf("max_output_tokens = %d, want %d", got, want)
	}
	if got, want := len(definition.sources), 2; got != want {
		t.Fatalf("len(sources) = %d, want %d", got, want)
	}
	if got, want := definition.sources[0].aliasID, SourceIDGitHubModels; got != want {
		t.Fatalf("primary source id = %q, want %q", got, want)
	}
	if got, want := definition.sources[1].aliasID, SourceIDOpenRouter; got != want {
		t.Fatalf("secondary source id = %q, want %q", got, want)
	}
	if definition.pricing == nil {
		t.Fatal("pricing = nil")
	}
	if got, want := definition.pricing.Input, "0.00000125"; got != want {
		t.Fatalf("input pricing = %q, want %q", got, want)
	}
}

func TestDefinitionSyncReconcilerCollectsGitHubProxyDefinitionsViaVendorAlias(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if got, want := r.URL.Path, "/github"; got != want {
			t.Fatalf("path = %q, want %q", got, want)
		}
		_, _ = w.Write([]byte(`[
			{"id":"cohere/cohere-command-a","name":"Cohere Command A","supported_input_modalities":["text"],"supported_output_modalities":["text"]}
		]`))
	}))
	defer server.Close()

	client := ctrlclientfake.NewClientBuilder().
		WithScheme(testutil.NewScheme()).
		Build()

	reconciler := newCollectionTestReconciler(client, map[string]string{
		SourceIDGitHubModels:    server.URL + "/github",
		SourceIDOpenRouter:      "://bad-url",
		SourceIDModelScope:      "://bad-url",
		SourceIDCerebras:        "://bad-url",
		SourceIDNVIDIAIntegrate: "://bad-url",
		SourceIDHuggingFaceHub:  "://bad-url",
	})

	snapshot, err := reconciler.collectAuthoritativeDefinitions(context.Background())
	if err != nil {
		t.Fatalf("collectAuthoritativeDefinitions() error = %v", err)
	}

	proxy := snapshot.definitions[identityKey("github", "cohere/cohere-command-a")]
	if got, want := proxy.sourceRef.GetVendorId(), "cohere"; got != want {
		t.Fatalf("proxy source vendor id = %q, want %q", got, want)
	}
	if got, want := proxy.sourceRef.GetModelId(), "cohere-command-a"; got != want {
		t.Fatalf("proxy source model id = %q, want %q", got, want)
	}
}

func TestDefinitionSyncReconcilerCollectsCerebrasProxyDefinitions(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if got, want := r.URL.Path, "/cerebras"; got != want {
			t.Fatalf("path = %q, want %q", got, want)
		}
		_, _ = w.Write([]byte(`{"data":[
			{"id":"gpt-oss-120b","owned_by":"openai","name":"GPT OSS 120B","pricing":{"prompt":"0.0000006","completion":"0.0000012"}}
		]}`))
	}))
	defer server.Close()

	client := ctrlclientfake.NewClientBuilder().
		WithScheme(testutil.NewScheme()).
		Build()

	reconciler := newCollectionTestReconciler(client, map[string]string{
		SourceIDGitHubModels:    "://bad-url",
		SourceIDOpenRouter:      "://bad-url",
		SourceIDModelScope:      "://bad-url",
		SourceIDCerebras:        server.URL + "/cerebras",
		SourceIDNVIDIAIntegrate: "://bad-url",
		SourceIDHuggingFaceHub:  "://bad-url",
	})

	snapshot, err := reconciler.collectAuthoritativeDefinitions(context.Background())
	if err != nil {
		t.Fatalf("collectAuthoritativeDefinitions() error = %v", err)
	}

	proxy := snapshot.definitions[identityKey("cerebras", "gpt-oss-120b")]
	if got, want := proxy.sourceRef.GetVendorId(), "openai"; got != want {
		t.Fatalf("proxy source vendor id = %q, want %q", got, want)
	}
	if got, want := proxy.sourceRef.GetModelId(), "gpt-oss-120b"; got != want {
		t.Fatalf("proxy source model id = %q, want %q", got, want)
	}
}

func TestDefinitionSyncReconcilerAllowsEmptySnapshotWhenAllSourcesUnavailable(t *testing.T) {
	t.Parallel()

	client := ctrlclientfake.NewClientBuilder().
		WithScheme(testutil.NewScheme()).
		Build()

	reconciler := newCollectionTestReconciler(client, map[string]string{
		SourceIDGitHubModels:    "://bad-url",
		SourceIDOpenRouter:      "://bad-url",
		SourceIDModelScope:      "://bad-url",
		SourceIDCerebras:        "://bad-url",
		SourceIDNVIDIAIntegrate: "://bad-url",
		SourceIDHuggingFaceHub:  "://bad-url",
	})

	snapshot, err := reconciler.collectAuthoritativeDefinitions(context.Background())
	if err != nil {
		t.Fatalf("collectAuthoritativeDefinitions() error = %v, want nil", err)
	}
	if snapshot == nil {
		t.Fatal("snapshot = nil, want non-nil")
	}
	if got := len(snapshot.definitions); got != 0 {
		t.Fatalf("len(definitions) = %d, want 0", got)
	}
}

func newCollectionTestReconciler(client ctrlclient.Client, endpoints map[string]string) *DefinitionSyncReconciler {
	return &DefinitionSyncReconciler{
		client:          client,
		namespace:       "code-code",
		logger:          slog.Default(),
		sourceEndpoints: normalizeDefinitionSourceEndpoints(endpoints),
	}
}
