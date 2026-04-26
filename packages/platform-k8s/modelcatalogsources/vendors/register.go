package vendors

import (
	"context"
	"fmt"
	"slices"
	"strings"

	apiprotocolv1 "code-code.internal/go-contract/api_protocol/v1"
	modelv1 "code-code.internal/go-contract/model/v1"
	modelcatalogdiscoveryv1 "code-code.internal/go-contract/model_catalog_discovery/v1"
	modelservicev1 "code-code.internal/go-contract/platform/model/v1"
	supportv1 "code-code.internal/go-contract/platform/support/v1"
	providerv1 "code-code.internal/go-contract/provider/v1"
	"code-code.internal/platform-k8s/modelcatalogdiscovery"
	"code-code.internal/platform-k8s/modelcatalogsources"
	vendorsupport "code-code.internal/platform-k8s/vendors/support"
	"google.golang.org/protobuf/proto"
)

type VendorSupportReader interface {
	List(context.Context) ([]*supportv1.Vendor, error)
}

type RegisterConfig struct {
	Support VendorSupportReader
	Probe   modelcatalogsources.ModelIDProbe
}

func Register(ctx context.Context, registry *modelcatalogsources.Registry, config RegisterConfig) error {
	if registry == nil {
		return fmt.Errorf("platformk8s/modelcatalogsources/vendors: registry is nil")
	}
	if config.Support == nil {
		return fmt.Errorf("platformk8s/modelcatalogsources/vendors: vendor support reader is nil")
	}
	vendors, err := config.Support.List(ctx)
	if err != nil {
		return err
	}
	for _, vendor := range vendors {
		if !hasCatalogCapability(vendor) {
			continue
		}
		vendorID := strings.TrimSpace(vendor.GetVendor().GetVendorId())
		if vendorID == "" {
			return fmt.Errorf("platformk8s/modelcatalogsources/vendors: vendor support id is empty")
		}
		if err := registry.Register(&vendorSource{
			ref:    modelcatalogsources.ProbeRef("vendor." + vendorID),
			vendor: proto.Clone(vendor).(*supportv1.Vendor),
			probe:  config.Probe,
		}); err != nil {
			return err
		}
	}
	return nil
}

func hasCatalogCapability(vendor *supportv1.Vendor) bool {
	if vendor == nil {
		return false
	}
	for _, binding := range vendor.GetProviderBindings() {
		if vendorsupport.SupportsModelCatalogProbe(binding) {
			return true
		}
	}
	return false
}

type vendorSource struct {
	ref    modelcatalogsources.CapabilityRef
	vendor *supportv1.Vendor
	probe  modelcatalogsources.ModelIDProbe
}

func (s *vendorSource) CapabilityRef() modelcatalogsources.CapabilityRef {
	return s.ref
}

func (s *vendorSource) ListModels(ctx context.Context, request *modelservicev1.FetchCatalogModelsRequest) ([]*modelservicev1.CatalogModel, error) {
	if strings.TrimSpace(request.GetTarget().GetTargetId()) != "" {
		return s.listTargetModels(ctx, request)
	}
	models := s.staticDefinitions()
	if len(models) == 0 {
		return nil, fmt.Errorf("platformk8s/modelcatalogsources/vendors: vendor %q has no model catalog source data", s.ref.ID)
	}
	return catalogModelsFromDefinitions(models), nil
}

func (s *vendorSource) listTargetModels(ctx context.Context, request *modelservicev1.FetchCatalogModelsRequest) ([]*modelservicev1.CatalogModel, error) {
	surface, ok, err := s.catalogSurface(request.GetTarget())
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, fmt.Errorf("platformk8s/modelcatalogsources/vendors: target %q is not catalog-capable for vendor %q", request.GetTarget().GetTargetId(), s.ref.ID)
	}
	if operation, ok := s.operationForSurface(surface); ok {
		if s.probe == nil {
			return nil, fmt.Errorf("platformk8s/modelcatalogsources/vendors: probe executor is nil")
		}
		concurrencyKey, err := s.ref.Key()
		if err != nil {
			return nil, err
		}
		credentialID := strings.TrimSpace(request.GetAuthRef().GetCredentialId())
		if credentialID == "" {
			return nil, fmt.Errorf("platformk8s/modelcatalogsources/vendors: auth_ref is required for target %q", surface.id)
		}
		modelIDs, err := s.probe.ProbeModelIDs(ctx, modelcatalogsources.ProbeRequest{
			ProbeID:        s.ref.ID,
			Protocol:       surface.protocol,
			BaseURL:        surface.baseURL,
			AuthRef:        request.GetAuthRef(),
			Operation:      operation,
			ConcurrencyKey: concurrencyKey,
		})
		if err != nil {
			return nil, err
		}
		return catalogModelsFromModelIDs(s.ref.ID, s.staticDefinitions(), modelIDs), nil
	}
	if len(surface.staticCatalog) > 0 {
		return surface.staticCatalog, nil
	}
	return nil, fmt.Errorf("platformk8s/modelcatalogsources/vendors: target %q has no declared model catalog source", surface.id)
}

type catalogSurface struct {
	id            string
	protocol      apiprotocolv1.Protocol
	baseURL       string
	staticCatalog []*modelservicev1.CatalogModel
	binding       *supportv1.VendorProviderBinding
}

func (s *vendorSource) catalogSurface(target *modelservicev1.ModelCatalogTarget) (catalogSurface, bool, error) {
	targetID := strings.TrimSpace(target.GetTargetId())
	if targetID == "" {
		return catalogSurface{}, false, nil
	}
	for _, binding := range s.vendor.GetProviderBindings() {
		for _, template := range binding.GetSurfaceTemplates() {
			runtime := template.GetRuntime()
			if runtime == nil {
				continue
			}
			if strings.TrimSpace(template.GetSurfaceId()) != targetID {
				continue
			}
			protocol := providerv1.RuntimeProtocol(runtime)
			if protocol == apiprotocolv1.Protocol_PROTOCOL_UNSPECIFIED {
				return catalogSurface{}, true, fmt.Errorf("platformk8s/modelcatalogsources/vendors: surface %q protocol is unspecified", targetID)
			}
			baseURL := strings.TrimSpace(providerv1.RuntimeBaseURL(runtime))
			if baseURL == "" {
				return catalogSurface{}, true, fmt.Errorf("platformk8s/modelcatalogsources/vendors: surface %q base_url is empty", targetID)
			}
			return catalogSurface{
				id:            targetID,
				protocol:      protocol,
				baseURL:       baseURL,
				staticCatalog: catalogModelsFromSurfaceCatalog(s.ref.ID, template.GetBootstrapCatalog().GetModels()),
				binding:       binding,
			}, true, nil
		}
	}
	return catalogSurface{}, true, fmt.Errorf("platformk8s/modelcatalogsources/vendors: surface %q is not declared by vendor %q", targetID, s.ref.ID)
}

func (s *vendorSource) operationForSurface(surface catalogSurface) (*modelcatalogdiscoveryv1.ModelCatalogDiscoveryOperation, bool) {
	collector := surface.binding.GetModelDiscovery().GetActiveDiscovery()
	if collector == nil {
		return nil, false
	}
	surfaceIDs := collector.GetSurfaceIds()
	if len(surfaceIDs) > 0 && !slices.Contains(surfaceIDs, surface.id) {
		return nil, false
	}
	if operation := collector.GetOperation(); operation != nil {
		return proto.Clone(operation).(*modelcatalogdiscoveryv1.ModelCatalogDiscoveryOperation), true
	}
	return modelcatalogdiscovery.DefaultAPIKeyDiscoveryOperation(surface.protocol), true
}

func (s *vendorSource) staticDefinitions() []*modelv1.ModelDefinition {
	out := []*modelv1.ModelDefinition{}
	for _, binding := range s.vendor.GetProviderBindings() {
		for _, template := range binding.GetSurfaceTemplates() {
			for _, model := range catalogModelsFromSurfaceCatalog(s.ref.ID, template.GetBootstrapCatalog().GetModels()) {
				if model.GetDefinition() == nil {
					continue
				}
				out = append(out, model.GetDefinition())
			}
		}
	}
	return staticDefinitions(s.ref.ID, out)
}

func catalogModelsFromSurfaceCatalog(ownerVendorID string, entries []*providerv1.ProviderModelCatalogEntry) []*modelservicev1.CatalogModel {
	out := make([]*modelservicev1.CatalogModel, 0, len(entries))
	for _, entry := range entries {
		sourceModelID := strings.TrimSpace(entry.GetProviderModelId())
		modelID := strings.TrimSpace(entry.GetModelRef().GetModelId())
		if modelID == "" {
			modelID = sourceModelID
		}
		vendorID := strings.TrimSpace(entry.GetModelRef().GetVendorId())
		if vendorID == "" {
			vendorID = strings.TrimSpace(ownerVendorID)
		}
		if sourceModelID == "" || modelID == "" || vendorID == "" {
			continue
		}
		out = append(out, &modelservicev1.CatalogModel{
			SourceModelId: sourceModelID,
			Definition: &modelv1.ModelDefinition{
				VendorId:    vendorID,
				ModelId:     modelID,
				DisplayName: modelID,
			},
		})
	}
	return out
}

func catalogModelsFromModelIDs(vendorID string, static []*modelv1.ModelDefinition, modelIDs []string) []*modelservicev1.CatalogModel {
	staticByID := map[string]*modelv1.ModelDefinition{}
	for _, definition := range staticDefinitions(vendorID, static) {
		staticByID[strings.TrimSpace(definition.GetModelId())] = definition
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
		if definition := staticByID[modelID]; definition != nil {
			out = append(out, &modelservicev1.CatalogModel{
				SourceModelId: modelID,
				Definition:    proto.Clone(definition).(*modelv1.ModelDefinition),
			})
			continue
		}
		out = append(out, &modelservicev1.CatalogModel{
			SourceModelId: modelID,
			Definition: &modelv1.ModelDefinition{
				VendorId:    strings.TrimSpace(vendorID),
				ModelId:     modelID,
				DisplayName: modelID,
			},
		})
	}
	return out
}

func catalogModelsFromDefinitions(definitions []*modelv1.ModelDefinition) []*modelservicev1.CatalogModel {
	out := make([]*modelservicev1.CatalogModel, 0, len(definitions))
	for _, definition := range definitions {
		modelID := strings.TrimSpace(definition.GetModelId())
		if modelID == "" {
			continue
		}
		out = append(out, &modelservicev1.CatalogModel{
			SourceModelId: modelID,
			Definition:    proto.Clone(definition).(*modelv1.ModelDefinition),
		})
	}
	return out
}

func staticDefinitions(ownerVendorID string, definitions []*modelv1.ModelDefinition) []*modelv1.ModelDefinition {
	out := make([]*modelv1.ModelDefinition, 0, len(definitions))
	for _, definition := range definitions {
		if definition == nil {
			continue
		}
		next := proto.Clone(definition).(*modelv1.ModelDefinition)
		if strings.TrimSpace(next.GetVendorId()) == "" {
			next.VendorId = strings.TrimSpace(ownerVendorID)
		}
		if strings.TrimSpace(next.GetModelId()) == "" {
			continue
		}
		if strings.TrimSpace(next.GetDisplayName()) == "" {
			next.DisplayName = strings.TrimSpace(next.GetModelId())
		}
		out = append(out, next)
	}
	return out
}
