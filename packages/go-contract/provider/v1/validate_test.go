package providerv1

import (
	"testing"

	apiprotocolv1 "code-code.internal/go-contract/api_protocol/v1"
	credentialv1 "code-code.internal/go-contract/credential/v1"
	modelv1 "code-code.internal/go-contract/model/v1"
)

func TestValidateProviderAcceptsSurfaceOwnedCredentialAndCatalog(t *testing.T) {
	t.Parallel()

	provider := &Provider{
		ProviderId:  "provider-1",
		DisplayName: "Provider 1",
		Surfaces: []*ProviderSurfaceBinding{{
			SurfaceId: "openai-compatible",
			ProviderCredentialRef: &ProviderCredentialRef{
				ProviderCredentialId: "credential-1",
			},
			Runtime: testAPISurfaceRuntime(),
		}},
	}

	if err := ValidateProvider(provider); err != nil {
		t.Fatalf("ValidateProvider() error = %v", err)
	}
}

func TestValidateProviderSurfaceBindingRejectsMissingBaseURL(t *testing.T) {
	t.Parallel()

	surface := &ProviderSurfaceBinding{
		SurfaceId: "openai-compatible",
		Runtime: &ProviderSurfaceRuntime{
			DisplayName: "OpenAI Compatible",
			Origin:      ProviderSurfaceOrigin_PROVIDER_SURFACE_ORIGIN_DERIVED,
			Access: &ProviderSurfaceRuntime_Api{Api: &ProviderAPISurfaceRuntime{
				Protocol: apiprotocolv1.Protocol_PROTOCOL_OPENAI_COMPATIBLE,
			}},
		},
	}

	if err := ValidateProviderSurfaceBinding(surface); err == nil {
		t.Fatal("ValidateProviderSurfaceBinding() expected error, got nil")
	}
}

func TestValidateProviderSurfaceBindingRejectsInvalidProviderCredentialRef(t *testing.T) {
	t.Parallel()

	surface := testCompatibleSurface()
	surface.ProviderCredentialRef = &ProviderCredentialRef{}

	if err := ValidateProviderSurfaceBinding(surface); err == nil {
		t.Fatal("ValidateProviderSurfaceBinding() expected error, got nil")
	}
}

func TestValidateProviderSurfaceBindingRejectsSourceRefWithoutSurfaceID(t *testing.T) {
	t.Parallel()

	surface := testCompatibleSurface()
	surface.SourceRef = &ProviderSurfaceSourceRef{
		Kind: ProviderSurfaceSourceKind_PROVIDER_SURFACE_SOURCE_KIND_VENDOR,
		Id:   "openai",
	}

	if err := ValidateProviderSurfaceBinding(surface); err == nil {
		t.Fatal("ValidateProviderSurfaceBinding() expected error, got nil")
	}
}

func TestValidateProviderSurfaceRuntimeAcceptsCatalog(t *testing.T) {
	t.Parallel()

	runtime := testAPISurfaceRuntime()
	runtime.Catalog = &ProviderModelCatalog{
		Source: CatalogSource_CATALOG_SOURCE_FALLBACK_CONFIG,
		Models: []*ProviderModelCatalogEntry{{
			ProviderModelId: "gpt-4o-mini",
			ModelRef: &modelv1.ModelRef{
				ModelId: "shared-model",
			},
		}},
	}

	if err := ValidateProviderSurfaceRuntime(runtime); err != nil {
		t.Fatalf("ValidateProviderSurfaceRuntime() error = %v", err)
	}
}

func TestValidateProviderModelCatalogRejectsDuplicateProviderModelID(t *testing.T) {
	t.Parallel()

	catalog := &ProviderModelCatalog{
		Source: CatalogSource_CATALOG_SOURCE_FALLBACK_CONFIG,
		Models: []*ProviderModelCatalogEntry{
			{ProviderModelId: "gpt-4o-mini"},
			{ProviderModelId: "gpt-4o-mini"},
		},
	}

	if err := ValidateProviderModelCatalog(catalog); err == nil {
		t.Fatal("ValidateProviderModelCatalog() expected error, got nil")
	}
}

func TestValidateResolvedProviderModelAcceptsResolvedCatalogSource(t *testing.T) {
	t.Parallel()

	resolved := &ResolvedProviderModel{
		SurfaceId:       "openai-compatible",
		ProviderModelId: "gpt-4o-mini",
		Protocol:        apiprotocolv1.Protocol_PROTOCOL_OPENAI_COMPATIBLE,
		BaseUrl:         "https://example.com/v1",
		Source:          CatalogSource_CATALOG_SOURCE_MODEL_SERVICE,
		Surface:         &ResolvedProviderSurface{Surface: testAPISurfaceRuntime()},
		Model: &modelv1.ResolvedModel{
			ModelId: "gpt-4o-mini",
			EffectiveDefinition: &modelv1.ModelVersion{
				ModelId:      "gpt-4o-mini",
				VendorId:     "openai",
				PrimaryShape: modelv1.ModelShape_MODEL_SHAPE_CHAT_COMPLETIONS,
			},
		},
	}

	if err := ValidateResolvedProviderModel(testCompatibleProviderSurface(), testCompatibleSurface(), resolved); err != nil {
		t.Fatalf("ValidateResolvedProviderModel() error = %v", err)
	}
}

func testCompatibleProviderSurface() *ProviderSurface {
	return &ProviderSurface{
		SurfaceId:                "openai-compatible",
		DisplayName:              "OpenAI Compatible",
		SupportedCredentialKinds: []credentialv1.CredentialKind{credentialv1.CredentialKind_CREDENTIAL_KIND_API_KEY},
		Kind:                     ProviderSurfaceKind_PROVIDER_SURFACE_KIND_API,
		Api: &ProviderSurfaceAPISpec{
			SupportedProtocols: []apiprotocolv1.Protocol{apiprotocolv1.Protocol_PROTOCOL_OPENAI_COMPATIBLE},
		},
		Capabilities: &ProviderCapabilities{},
	}
}

func testCompatibleSurface() *ProviderSurfaceBinding {
	return &ProviderSurfaceBinding{
		SurfaceId: "openai-compatible",
		Runtime:   testAPISurfaceRuntime(),
	}
}

func testAPISurfaceRuntime() *ProviderSurfaceRuntime {
	return &ProviderSurfaceRuntime{
		DisplayName: "OpenAI Compatible",
		Origin:      ProviderSurfaceOrigin_PROVIDER_SURFACE_ORIGIN_DERIVED,
		Access: &ProviderSurfaceRuntime_Api{Api: &ProviderAPISurfaceRuntime{
			Protocol: apiprotocolv1.Protocol_PROTOCOL_OPENAI_COMPATIBLE,
			BaseUrl:  "https://example.com/v1",
		}},
	}
}
