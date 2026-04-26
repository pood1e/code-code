package providercatalogs

import (
	"context"
	"fmt"
	"log/slog"
	"strings"

	credentialv1 "code-code.internal/go-contract/credential/v1"
	modelv1 "code-code.internal/go-contract/model/v1"
	modelservicev1 "code-code.internal/go-contract/platform/model/v1"
	providerv1 "code-code.internal/go-contract/provider/v1"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/types/known/timestamppb"
)

type ModelCatalogLister interface {
	GetOrFetchCatalogModels(context.Context, *modelservicev1.GetOrFetchCatalogModelsRequest) ([]*modelservicev1.CatalogModel, error)
}

type CatalogMaterializer struct {
	lister ModelCatalogLister
	logger *slog.Logger
}

func NewCatalogMaterializer(lister ModelCatalogLister, logger *slog.Logger) *CatalogMaterializer {
	if logger == nil {
		logger = slog.Default()
	}
	return &CatalogMaterializer{lister: lister, logger: logger}
}

func (m *CatalogMaterializer) MaterializeProvider(ctx context.Context, provider *providerv1.Provider) (*providerv1.Provider, error) {
	if m == nil || m.lister == nil || provider == nil {
		return provider, nil
	}
	next := proto.Clone(provider).(*providerv1.Provider)
	for _, surface := range next.GetSurfaces() {
		if err := m.materializeSurface(ctx, surface); err != nil {
			return nil, fmt.Errorf("platformk8s/providercatalogs: materialize surface %q catalog: %w", surface.GetSurfaceId(), err)
		}
	}
	return next, nil
}

func (m *CatalogMaterializer) materializeSurface(ctx context.Context, surface *providerv1.ProviderSurfaceBinding) error {
	request, ok := surfaceCatalogRequest(surface)
	if !ok {
		return nil
	}
	models, err := m.lister.GetOrFetchCatalogModels(ctx, request)
	if err != nil {
		return err
	}
	modelIDs := modelIDsFromCatalogRows(models)
	current := surface.GetRuntime().GetCatalog()
	if catalogAlreadyCurrent(current, modelIDs) {
		return nil
	}
	catalog := catalogFromRows(current, models)
	runtime := proto.Clone(surface.GetRuntime()).(*providerv1.ProviderSurfaceRuntime)
	runtime.Catalog = catalog
	surface.Runtime = runtime
	return nil
}

func surfaceCatalogRequest(surface *providerv1.ProviderSurfaceBinding) (*modelservicev1.GetOrFetchCatalogModelsRequest, bool) {
	if surface == nil || surface.GetRuntime() == nil {
		return nil, false
	}
	runtime := surface.GetRuntime()
	probeID := strings.TrimSpace(runtime.GetModelCatalogProbeId())
	if probeID == "" {
		return nil, false
	}
	source := surface.GetSourceRef()
	targetID := strings.TrimSpace(source.GetSurfaceId())
	if targetID == "" {
		return nil, false
	}
	target := &modelservicev1.ModelCatalogTarget{TargetId: targetID}
	if shouldPassSurfaceBaseURL(surface) {
		target.BaseUrl = strings.TrimSpace(providerv1.RuntimeBaseURL(runtime))
		target.Protocol = providerv1.RuntimeProtocol(runtime)
	}
	request := &modelservicev1.GetOrFetchCatalogModelsRequest{
		ProbeId: probeID,
		Target:  target,
	}
	if credentialID := strings.TrimSpace(surface.GetProviderCredentialRef().GetProviderCredentialId()); credentialID != "" {
		request.AuthRef = &credentialv1.CredentialRef{CredentialId: credentialID}
	}
	return request, true
}

func shouldPassSurfaceBaseURL(surface *providerv1.ProviderSurfaceBinding) bool {
	if surface == nil {
		return false
	}
	runtime := surface.GetRuntime()
	return providerv1.RuntimeKind(runtime) == providerv1.ProviderSurfaceKind_PROVIDER_SURFACE_KIND_API &&
		strings.TrimSpace(providerv1.RuntimeBaseURL(runtime)) != ""
}

func catalogFromRows(current *providerv1.ProviderModelCatalog, models []*modelservicev1.CatalogModel) *providerv1.ProviderModelCatalog {
	modelRefs := existingModelRefs(current)
	entries := make([]*providerv1.ProviderModelCatalogEntry, 0, len(models))
	for _, model := range models {
		sourceModelID := strings.TrimSpace(model.GetSourceModelId())
		if sourceModelID == "" {
			sourceModelID = strings.TrimSpace(model.GetDefinition().GetModelId())
		}
		if sourceModelID == "" {
			continue
		}
		modelRef := modelRefs[sourceModelID]
		if modelRef == nil {
			modelRef = refFromDefinition(model.GetDefinition())
		}
		entries = append(entries, &providerv1.ProviderModelCatalogEntry{
			ProviderModelId: sourceModelID,
			ModelRef:        modelRef,
		})
	}
	return &providerv1.ProviderModelCatalog{
		Models:    entries,
		Source:    providerv1.CatalogSource_CATALOG_SOURCE_MODEL_SERVICE,
		UpdatedAt: timestamppb.Now(),
	}
}

func modelIDsFromCatalogRows(models []*modelservicev1.CatalogModel) []string {
	out := make([]string, 0, len(models))
	seen := map[string]struct{}{}
	for _, model := range models {
		modelID := strings.TrimSpace(model.GetSourceModelId())
		if modelID == "" {
			modelID = strings.TrimSpace(model.GetDefinition().GetModelId())
		}
		if modelID == "" {
			continue
		}
		if _, ok := seen[modelID]; ok {
			continue
		}
		seen[modelID] = struct{}{}
		out = append(out, modelID)
	}
	return out
}

func refFromDefinition(definition *modelv1.ModelDefinition) *modelv1.ModelRef {
	if definition == nil {
		return nil
	}
	vendorID := strings.TrimSpace(definition.GetVendorId())
	modelID := strings.TrimSpace(definition.GetModelId())
	if vendorID == "" || modelID == "" {
		return nil
	}
	return &modelv1.ModelRef{VendorId: vendorID, ModelId: modelID}
}

func catalogAlreadyCurrent(current *providerv1.ProviderModelCatalog, modelIDs []string) bool {
	if current.GetSource() != providerv1.CatalogSource_CATALOG_SOURCE_MODEL_SERVICE {
		return false
	}
	currentModels := current.GetModels()
	if len(currentModels) != len(modelIDs) {
		return false
	}
	for index, modelID := range modelIDs {
		if strings.TrimSpace(currentModels[index].GetProviderModelId()) != strings.TrimSpace(modelID) {
			return false
		}
	}
	return true
}

func existingModelRefs(catalog *providerv1.ProviderModelCatalog) map[string]*modelv1.ModelRef {
	out := map[string]*modelv1.ModelRef{}
	for _, item := range catalog.GetModels() {
		modelID := strings.TrimSpace(item.GetProviderModelId())
		if modelID == "" || item.GetModelRef() == nil {
			continue
		}
		out[modelID] = proto.Clone(item.GetModelRef()).(*modelv1.ModelRef)
	}
	return out
}
