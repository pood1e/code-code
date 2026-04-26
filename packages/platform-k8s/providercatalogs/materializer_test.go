package providercatalogs

import (
	"context"
	"testing"

	apiprotocolv1 "code-code.internal/go-contract/api_protocol/v1"
	modelv1 "code-code.internal/go-contract/model/v1"
	modelservicev1 "code-code.internal/go-contract/platform/model/v1"
	providerv1 "code-code.internal/go-contract/provider/v1"
)

func TestMaterializeProviderUsesSourceEndpointTemplateID(t *testing.T) {
	t.Parallel()

	lister := &catalogListerStub{
		models: []*modelservicev1.CatalogModel{{
			SourceModelId: "MiniMax-Text-01",
			Definition: &modelv1.ModelDefinition{
				VendorId: "minimax",
				ModelId:  "MiniMax-Text-01",
			},
		}},
	}
	materializer := NewCatalogMaterializer(lister, nil)

	provider, err := materializer.MaterializeProvider(context.Background(), &providerv1.Provider{
		ProviderId:  "minimax-account",
		DisplayName: "MiniMax",
		Surfaces: []*providerv1.ProviderSurfaceBinding{{
			SurfaceId: "minimax-6e6300",
			Runtime: &providerv1.ProviderSurfaceRuntime{
				DisplayName:         "MiniMax OpenAI Compatible",
				Origin:              providerv1.ProviderSurfaceOrigin_PROVIDER_SURFACE_ORIGIN_DERIVED,
				ModelCatalogProbeId: "surface.openai-compatible",
				Access: &providerv1.ProviderSurfaceRuntime_Api{
					Api: &providerv1.ProviderAPISurfaceRuntime{
						Protocol: apiprotocolv1.Protocol_PROTOCOL_OPENAI_COMPATIBLE,
						BaseUrl:  "https://api.minimaxi.com/v1",
					},
				},
			},
			SourceRef: &providerv1.ProviderSurfaceSourceRef{
				Kind:      providerv1.ProviderSurfaceSourceKind_PROVIDER_SURFACE_SOURCE_KIND_VENDOR,
				Id:        "minimax",
				SurfaceId: "minimax-openai-compatible",
			},
		}},
	})
	if err != nil {
		t.Fatalf("MaterializeProvider() error = %v", err)
	}
	if got, want := lister.last.GetTarget().GetTargetId(), "minimax-openai-compatible"; got != want {
		t.Fatalf("catalog target id = %q, want %q", got, want)
	}
	if got, want := lister.last.GetProbeId(), "surface.openai-compatible"; got != want {
		t.Fatalf("catalog probe id = %q, want %q", got, want)
	}
	if got, want := provider.GetSurfaces()[0].GetRuntime().GetCatalog().GetModels()[0].GetProviderModelId(), "MiniMax-Text-01"; got != want {
		t.Fatalf("catalog provider_model_id = %q, want %q", got, want)
	}
}

type catalogListerStub struct {
	last   *modelservicev1.GetOrFetchCatalogModelsRequest
	models []*modelservicev1.CatalogModel
}

func (s *catalogListerStub) GetOrFetchCatalogModels(_ context.Context, request *modelservicev1.GetOrFetchCatalogModelsRequest) ([]*modelservicev1.CatalogModel, error) {
	s.last = request
	return s.models, nil
}
