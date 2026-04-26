package clis

import (
	"context"
	"testing"

	modelv1 "code-code.internal/go-contract/model/v1"
	modelservicev1 "code-code.internal/go-contract/platform/model/v1"
	supportv1 "code-code.internal/go-contract/platform/support/v1"
	providerv1 "code-code.internal/go-contract/provider/v1"
	"code-code.internal/platform-k8s/modelcatalogsources"
)

func TestRegisterCLISourceReturnsDefaultCatalogModels(t *testing.T) {
	registry := modelcatalogsources.NewRegistry()
	err := Register(context.Background(), registry, RegisterConfig{
		Support: cliSupportStub{items: []*supportv1.CLI{{
			CliId:    "codex",
			VendorId: "openai",
			Oauth: &supportv1.OAuthSupport{
				ModelCatalog: &supportv1.OAuthModelCatalog{
					DefaultCatalog: &providerv1.ProviderModelCatalog{
						Models: []*providerv1.ProviderModelCatalogEntry{{
							ProviderModelId: "gpt-5.4",
							ModelRef:        &modelv1.ModelRef{VendorId: "openai", ModelId: "gpt-5.4"},
						}},
					},
				},
			},
		}}},
	})
	if err != nil {
		t.Fatalf("Register() error = %v", err)
	}
	models, err := registry.ListModels(context.Background(), modelcatalogsources.ProbeRef("cli.codex"), &modelservicev1.FetchCatalogModelsRequest{})
	if err != nil {
		t.Fatalf("ListModels() error = %v", err)
	}
	if got, want := models[0].GetDefinition().GetVendorId(), "openai"; got != want {
		t.Fatalf("vendor_id = %q, want %q", got, want)
	}
}

func TestRegisterCLISourceSkipsAuthOnlyCatalog(t *testing.T) {
	registry := modelcatalogsources.NewRegistry()
	err := Register(context.Background(), registry, RegisterConfig{
		Support: cliSupportStub{items: []*supportv1.CLI{{
			CliId: "codex",
			Oauth: &supportv1.OAuthSupport{
				ModelCatalog: &supportv1.OAuthModelCatalog{
					AuthenticatedDiscovery: &supportv1.OAuthModelCatalogDiscovery{},
				},
			},
		}}},
	})
	if err != nil {
		t.Fatalf("Register() error = %v", err)
	}
	if registry.Has(modelcatalogsources.ProbeRef("cli.codex")) {
		t.Fatalf("auth-only CLI catalog source was registered")
	}
}

type cliSupportStub struct {
	items []*supportv1.CLI
}

func (s cliSupportStub) List(context.Context) ([]*supportv1.CLI, error) {
	return s.items, nil
}
