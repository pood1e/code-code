package modelcatalogsources

import (
	"context"
	"testing"

	modelv1 "code-code.internal/go-contract/model/v1"
	modelservicev1 "code-code.internal/go-contract/platform/model/v1"
)

func TestRegistryRejectsDuplicateSource(t *testing.T) {
	registry := NewRegistry()
	source := testSource{ref: ProbeRef("test.openai")}
	if err := registry.Register(source); err != nil {
		t.Fatalf("Register() error = %v", err)
	}
	if err := registry.Register(source); err == nil {
		t.Fatal("Register() error = nil, want duplicate source error")
	}
}

func TestRegistryListsModelsFromSource(t *testing.T) {
	registry := NewRegistry()
	source := testSource{
		ref: ProbeRef("test.openai"),
		models: []*modelservicev1.CatalogModel{{
			SourceModelId: "gpt-5.4",
			Definition: &modelv1.ModelDefinition{
				VendorId: "openai",
				ModelId:  "gpt-5.4",
			},
		}},
	}
	if err := registry.Register(source); err != nil {
		t.Fatalf("Register() error = %v", err)
	}
	models, err := registry.ListModels(context.Background(), ProbeRef("test.openai"), &modelservicev1.FetchCatalogModelsRequest{})
	if err != nil {
		t.Fatalf("ListModels() error = %v", err)
	}
	if got, want := models[0].GetDefinition().GetModelId(), "gpt-5.4"; got != want {
		t.Fatalf("model_id = %q, want %q", got, want)
	}
}

type testSource struct {
	ref    CapabilityRef
	models []*modelservicev1.CatalogModel
}

func (s testSource) CapabilityRef() CapabilityRef {
	return s.ref
}

func (s testSource) ListModels(context.Context, *modelservicev1.FetchCatalogModelsRequest) ([]*modelservicev1.CatalogModel, error) {
	return s.models, nil
}
