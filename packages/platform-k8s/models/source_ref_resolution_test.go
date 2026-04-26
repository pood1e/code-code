package models

import (
	"io"
	"log/slog"
	"testing"

	modelv1 "code-code.internal/go-contract/model/v1"
)

func TestEnforceCollectedDefinitionRelationshipsResolvesAliasSourceRef(t *testing.T) {
	t.Parallel()

	snapshot := &collectedDefinitionsSnapshot{
		definitions: map[string]collectedDefinition{
			identityKey("mistral", "mistral-large"): {
				definition: &modelv1.ModelDefinition{
					VendorId: "mistral",
					ModelId:  "mistral-large",
					Aliases: []*modelv1.ModelAlias{{
						Kind:  modelv1.AliasKind_ALIAS_KIND_SNAPSHOT,
						Value: "mistral-large-2407",
					}},
				},
			},
			identityKey("openrouter", "mistral/mistral-large-2407"): {
				definition: &modelv1.ModelDefinition{
					VendorId: "openrouter",
					ModelId:  "mistral/mistral-large-2407",
				},
				sourceRef: &modelv1.ModelRef{
					VendorId: "mistral",
					ModelId:  "mistral-large-2407",
				},
			},
		},
	}

	enforceCollectedDefinitionRelationships(snapshot, slog.New(slog.NewTextHandler(io.Discard, nil)))

	proxy, ok := snapshot.definitions[identityKey("openrouter", "mistral/mistral-large-2407")]
	if !ok {
		t.Fatal("expected proxy definition to remain")
	}
	if got, want := proxy.sourceRef.GetVendorId(), "mistral"; got != want {
		t.Fatalf("sourceRef.vendorId = %q, want %q", got, want)
	}
	if got, want := proxy.sourceRef.GetModelId(), "mistral-large"; got != want {
		t.Fatalf("sourceRef.modelId = %q, want %q", got, want)
	}
}

func TestEnforceCollectedDefinitionRelationshipsDropsUnknownProxySourceRef(t *testing.T) {
	t.Parallel()

	snapshot := &collectedDefinitionsSnapshot{
		definitions: map[string]collectedDefinition{
			identityKey("openrouter", "openai/gpt-4o-2024-11-20"): {
				definition: &modelv1.ModelDefinition{
					VendorId: "openrouter",
					ModelId:  "openai/gpt-4o-2024-11-20",
				},
				sourceRef: &modelv1.ModelRef{
					VendorId: "openai",
					ModelId:  "gpt-4o-2024-11-20",
				},
			},
		},
	}

	enforceCollectedDefinitionRelationships(snapshot, slog.New(slog.NewTextHandler(io.Discard, nil)))

	if _, ok := snapshot.definitions[identityKey("openrouter", "openai/gpt-4o-2024-11-20")]; ok {
		t.Fatal("expected proxy definition to be dropped")
	}
}
