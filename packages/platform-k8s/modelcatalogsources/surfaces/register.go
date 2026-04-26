package surfaces

import (
	"context"
	"fmt"
	"strings"

	apiprotocolv1 "code-code.internal/go-contract/api_protocol/v1"
	credentialv1 "code-code.internal/go-contract/credential/v1"
	modelv1 "code-code.internal/go-contract/model/v1"
	modelservicev1 "code-code.internal/go-contract/platform/model/v1"
	providerv1 "code-code.internal/go-contract/provider/v1"
	"code-code.internal/platform-k8s/modelcatalogdiscovery"
	"code-code.internal/platform-k8s/modelcatalogsources"
	"code-code.internal/platform-k8s/providers"
	surfaceregistry "code-code.internal/platform-k8s/providersurfaces/registry"
	"google.golang.org/protobuf/proto"
)

type RegisterConfig struct {
	Probe    modelcatalogsources.ModelIDProbe
	Adapters *ModelCatalogAdapterRegistry
}

type ModelCatalogAdapter interface {
	ListModels(context.Context, *providerv1.ProviderSurface, *modelservicev1.FetchCatalogModelsRequest) ([]*modelservicev1.CatalogModel, error)
}

type ModelCatalogAdapterRegistry struct {
	items map[string]ModelCatalogAdapter
}

func NewModelCatalogAdapterRegistry() *ModelCatalogAdapterRegistry {
	return &ModelCatalogAdapterRegistry{items: map[string]ModelCatalogAdapter{}}
}

func (r *ModelCatalogAdapterRegistry) Register(surfaceID string, adapter ModelCatalogAdapter) error {
	if r == nil {
		return fmt.Errorf("platformk8s/modelcatalogsources/surfaces: adapter registry is nil")
	}
	surfaceID = strings.TrimSpace(surfaceID)
	if surfaceID == "" {
		return fmt.Errorf("platformk8s/modelcatalogsources/surfaces: surface id is empty")
	}
	if adapter == nil {
		return fmt.Errorf("platformk8s/modelcatalogsources/surfaces: adapter for surface %q is nil", surfaceID)
	}
	if _, exists := r.items[surfaceID]; exists {
		return fmt.Errorf("platformk8s/modelcatalogsources/surfaces: adapter for surface %q already registered", surfaceID)
	}
	r.items[surfaceID] = adapter
	return nil
}

func (r *ModelCatalogAdapterRegistry) Get(surfaceID string) ModelCatalogAdapter {
	if r == nil {
		return nil
	}
	return r.items[strings.TrimSpace(surfaceID)]
}

func Register(registry *modelcatalogsources.Registry, config RegisterConfig) error {
	if registry == nil {
		return fmt.Errorf("platformk8s/modelcatalogsources/surfaces: registry is nil")
	}
	for _, surface := range surfaceregistry.List() {
		if !supportsBestEffortCatalogProbe(surface) {
			continue
		}
		if err := registry.Register(&surfaceSource{
			ref:      modelcatalogsources.ProbeRef(providers.SurfaceModelCatalogProbeID(surface.GetSurfaceId())),
			surface:  cloneSurface(surface),
			probe:    config.Probe,
			adapters: config.Adapters,
		}); err != nil {
			return err
		}
	}
	return nil
}

type surfaceSource struct {
	ref      modelcatalogsources.CapabilityRef
	surface  *providerv1.ProviderSurface
	probe    modelcatalogsources.ModelIDProbe
	adapters *ModelCatalogAdapterRegistry
}

func (s *surfaceSource) CapabilityRef() modelcatalogsources.CapabilityRef {
	return s.ref
}

func (s *surfaceSource) ListModels(ctx context.Context, request *modelservicev1.FetchCatalogModelsRequest) ([]*modelservicev1.CatalogModel, error) {
	if s == nil || s.surface == nil {
		return nil, fmt.Errorf("platformk8s/modelcatalogsources/surfaces: surface probe source is nil")
	}
	switch modelCatalogProbeMethod(s.surface) {
	case providerv1.ProviderSurfaceModelCatalogProbeMethod_PROVIDER_SURFACE_MODEL_CATALOG_PROBE_METHOD_PROTOCOL_BEST_EFFORT:
		return s.listProtocolBestEffort(ctx, request)
	case providerv1.ProviderSurfaceModelCatalogProbeMethod_PROVIDER_SURFACE_MODEL_CATALOG_PROBE_METHOD_STATIC,
		providerv1.ProviderSurfaceModelCatalogProbeMethod_PROVIDER_SURFACE_MODEL_CATALOG_PROBE_METHOD_ADAPTER:
		adapter := s.adapters.Get(s.surface.GetSurfaceId())
		if adapter == nil {
			return nil, fmt.Errorf("platformk8s/modelcatalogsources/surfaces: model catalog adapter for surface %q is not registered", s.surface.GetSurfaceId())
		}
		return adapter.ListModels(ctx, cloneSurface(s.surface), request)
	default:
		return nil, fmt.Errorf("platformk8s/modelcatalogsources/surfaces: surface %q does not declare a supported model catalog probe method", s.surface.GetSurfaceId())
	}
}

func (s *surfaceSource) listProtocolBestEffort(ctx context.Context, request *modelservicev1.FetchCatalogModelsRequest) ([]*modelservicev1.CatalogModel, error) {
	if s.probe == nil {
		return nil, fmt.Errorf("platformk8s/modelcatalogsources/surfaces: probe executor is nil")
	}
	baseURL := strings.TrimSpace(request.GetTarget().GetBaseUrl())
	if baseURL == "" {
		return nil, fmt.Errorf("platformk8s/modelcatalogsources/surfaces: target base_url is required for surface %q", s.surface.GetSurfaceId())
	}
	protocol := request.GetTarget().GetProtocol()
	if protocol == apiprotocolv1.Protocol_PROTOCOL_UNSPECIFIED {
		return nil, fmt.Errorf("platformk8s/modelcatalogsources/surfaces: target protocol is required for surface %q", s.surface.GetSurfaceId())
	}
	if !surfaceSupportsProtocol(s.surface, protocol) {
		return nil, fmt.Errorf(
			"platformk8s/modelcatalogsources/surfaces: surface %q does not support protocol %s",
			s.surface.GetSurfaceId(),
			protocol.String(),
		)
	}
	modelIDs, err := s.probe.ProbeModelIDs(ctx, modelcatalogsources.ProbeRequest{
		ProbeID:        s.ref.ID,
		Protocol:       protocol,
		BaseURL:        baseURL,
		AuthRef:        authRefOrNil(request.GetAuthRef()),
		Operation:      modelcatalogdiscovery.DefaultAPIKeyDiscoveryOperation(protocol),
		ConcurrencyKey: strings.TrimSpace(s.surface.GetSurfaceId()),
	})
	if err != nil {
		return nil, err
	}
	out := make([]*modelservicev1.CatalogModel, 0, len(modelIDs))
	seen := map[string]struct{}{}
	for _, rawModelID := range modelIDs {
		modelID := strings.TrimSpace(rawModelID)
		if modelID == "" {
			continue
		}
		if _, ok := seen[modelID]; ok {
			continue
		}
		seen[modelID] = struct{}{}
		out = append(out, &modelservicev1.CatalogModel{
			SourceModelId: modelID,
			Definition: &modelv1.ModelDefinition{
				ModelId:     modelID,
				DisplayName: modelID,
			},
		})
	}
	return out, nil
}

func supportsBestEffortCatalogProbe(surface *providerv1.ProviderSurface) bool {
	if surface == nil {
		return false
	}
	return surface.GetKind() == providerv1.ProviderSurfaceKind_PROVIDER_SURFACE_KIND_API &&
		supportsCredentialKind(surface.GetSupportedCredentialKinds(), credentialv1.CredentialKind_CREDENTIAL_KIND_API_KEY) &&
		(modelCatalogProbeMethod(surface) == providerv1.ProviderSurfaceModelCatalogProbeMethod_PROVIDER_SURFACE_MODEL_CATALOG_PROBE_METHOD_PROTOCOL_BEST_EFFORT ||
			modelCatalogProbeMethod(surface) == providerv1.ProviderSurfaceModelCatalogProbeMethod_PROVIDER_SURFACE_MODEL_CATALOG_PROBE_METHOD_STATIC ||
			modelCatalogProbeMethod(surface) == providerv1.ProviderSurfaceModelCatalogProbeMethod_PROVIDER_SURFACE_MODEL_CATALOG_PROBE_METHOD_ADAPTER)
}

func supportsCredentialKind(values []credentialv1.CredentialKind, want credentialv1.CredentialKind) bool {
	for _, value := range values {
		if value == want {
			return true
		}
	}
	return false
}

func surfaceSupportsProtocol(surface *providerv1.ProviderSurface, want apiprotocolv1.Protocol) bool {
	if surface == nil || surface.GetApi() == nil {
		return false
	}
	for _, value := range surface.GetApi().GetSupportedProtocols() {
		if value == want {
			return true
		}
	}
	return false
}

func authRefOrNil(authRef *credentialv1.CredentialRef) *credentialv1.CredentialRef {
	if strings.TrimSpace(authRef.GetCredentialId()) == "" {
		return nil
	}
	return &credentialv1.CredentialRef{CredentialId: strings.TrimSpace(authRef.GetCredentialId())}
}

func cloneSurface(surface *providerv1.ProviderSurface) *providerv1.ProviderSurface {
	if surface == nil {
		return nil
	}
	return proto.Clone(surface).(*providerv1.ProviderSurface)
}

func modelCatalogProbeMethod(surface *providerv1.ProviderSurface) providerv1.ProviderSurfaceModelCatalogProbeMethod {
	if surface == nil || surface.GetProbes() == nil || surface.GetProbes().GetModelCatalog() == nil {
		return providerv1.ProviderSurfaceModelCatalogProbeMethod_PROVIDER_SURFACE_MODEL_CATALOG_PROBE_METHOD_UNSPECIFIED
	}
	return surface.GetProbes().GetModelCatalog().GetMethod()
}
