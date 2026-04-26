package vendors

import (
	"context"
	"testing"

	apiprotocolv1 "code-code.internal/go-contract/api_protocol/v1"
	credentialv1 "code-code.internal/go-contract/credential/v1"
	modelv1 "code-code.internal/go-contract/model/v1"
	modelcatalogdiscoveryv1 "code-code.internal/go-contract/model_catalog_discovery/v1"
	modelservicev1 "code-code.internal/go-contract/platform/model/v1"
	supportv1 "code-code.internal/go-contract/platform/support/v1"
	providerv1 "code-code.internal/go-contract/provider/v1"
	vendordefinitionv1 "code-code.internal/go-contract/vendor_definition/v1"
	"code-code.internal/platform-k8s/modelcatalogsources"
)

func TestRegisterVendorSourceReturnsStaticModels(t *testing.T) {
	registry := modelcatalogsources.NewRegistry()
	err := Register(context.Background(), registry, RegisterConfig{
		Support: vendorSupportStub{items: []*supportv1.Vendor{{
			Vendor: &vendordefinitionv1.Vendor{VendorId: "minimax"},
			ProviderBindings: []*supportv1.VendorProviderBinding{{
				SurfaceTemplates: []*supportv1.ProviderSurfaceRuntimeTemplate{{
					SurfaceId: "minimax-openai-compatible",
					BootstrapCatalog: &providerv1.ProviderModelCatalog{
						Models: []*providerv1.ProviderModelCatalogEntry{{
							ProviderModelId: "abab6.5-chat",
							ModelRef:        &modelv1.ModelRef{VendorId: "minimax", ModelId: "abab6.5-chat"},
						}},
					},
				}},
			}},
		}}},
	})
	if err != nil {
		t.Fatalf("Register() error = %v", err)
	}
	models, err := registry.ListModels(context.Background(), modelcatalogsources.ProbeRef("vendor.minimax"), &modelservicev1.FetchCatalogModelsRequest{})
	if err != nil {
		t.Fatalf("ListModels() error = %v", err)
	}
	if got, want := models[0].GetDefinition().GetModelId(), "abab6.5-chat"; got != want {
		t.Fatalf("model_id = %q, want %q", got, want)
	}
}

func TestRegisterVendorSourceDispatchesThroughEndpointTemplate(t *testing.T) {
	registry := modelcatalogsources.NewRegistry()
	probe := &probeStub{modelIDs: []string{"accounts/fireworks/models/llama-v3p1-8b-instruct"}}
	err := Register(context.Background(), registry, RegisterConfig{
		Support: vendorSupportStub{items: []*supportv1.Vendor{{
			Vendor: &vendordefinitionv1.Vendor{VendorId: "fireworks-ai"},
			ProviderBindings: []*supportv1.VendorProviderBinding{{
				SurfaceTemplates: []*supportv1.ProviderSurfaceRuntimeTemplate{{
					SurfaceId: "fireworks-ai-openai-compatible",
					Runtime: &providerv1.ProviderSurfaceRuntime{
						Access: &providerv1.ProviderSurfaceRuntime_Api{
							Api: &providerv1.ProviderAPISurfaceRuntime{
								Protocol: apiprotocolv1.Protocol_PROTOCOL_OPENAI_COMPATIBLE,
								BaseUrl:  "https://api.fireworks.ai/inference/v1",
							},
						},
					},
				}},
				ModelDiscovery: &supportv1.VendorModelDiscovery{
					Strategy: &supportv1.VendorModelDiscovery_ActiveDiscovery{
						ActiveDiscovery: &supportv1.ActiveModelDiscovery{
							SurfaceIds: []string{"fireworks-ai-openai-compatible"},
							Operation: &modelcatalogdiscoveryv1.ModelCatalogDiscoveryOperation{
								Path:         "models",
								ResponseKind: modelcatalogdiscoveryv1.ModelCatalogDiscoveryResponseKind_MODEL_CATALOG_DISCOVERY_RESPONSE_KIND_OPENAI_MODELS,
							},
						},
					},
				},
			}},
		}}},
		Probe: probe,
	})
	if err != nil {
		t.Fatalf("Register() error = %v", err)
	}

	models, err := registry.ListModels(context.Background(), modelcatalogsources.ProbeRef("vendor.fireworks-ai"), &modelservicev1.FetchCatalogModelsRequest{
		Target: &modelservicev1.ModelCatalogTarget{TargetId: "fireworks-ai-openai-compatible"},
		AuthRef: &credentialv1.CredentialRef{
			CredentialId: "credential-a",
		},
	})
	if err != nil {
		t.Fatalf("ListModels() error = %v", err)
	}
	if got, want := probe.request.Protocol, apiprotocolv1.Protocol_PROTOCOL_OPENAI_COMPATIBLE; got != want {
		t.Fatalf("probe protocol = %s, want %s", got, want)
	}
	if got, want := probe.request.BaseURL, "https://api.fireworks.ai/inference/v1"; got != want {
		t.Fatalf("probe base_url = %q, want %q", got, want)
	}
	if got, want := probe.request.AuthRef.GetCredentialId(), "credential-a"; got != want {
		t.Fatalf("probe auth_ref = %q, want %q", got, want)
	}
	if got, want := probe.request.ConcurrencyKey, "vendor.fireworks-ai"; got != want {
		t.Fatalf("probe concurrency_key = %q, want %q", got, want)
	}
	if got, want := models[0].GetSourceModelId(), "accounts/fireworks/models/llama-v3p1-8b-instruct"; got != want {
		t.Fatalf("source_model_id = %q, want %q", got, want)
	}
}

type vendorSupportStub struct {
	items []*supportv1.Vendor
}

func (s vendorSupportStub) List(context.Context) ([]*supportv1.Vendor, error) {
	return s.items, nil
}

type probeStub struct {
	request  modelcatalogsources.ProbeRequest
	modelIDs []string
}

func (s *probeStub) ProbeModelIDs(_ context.Context, request modelcatalogsources.ProbeRequest) ([]string, error) {
	s.request = request
	return s.modelIDs, nil
}
