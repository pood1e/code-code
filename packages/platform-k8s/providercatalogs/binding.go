package providercatalogs

import (
	"context"
	"fmt"
	"log/slog"
	"strings"

	modelservicev1 "code-code.internal/go-contract/platform/model/v1"
	providerv1 "code-code.internal/go-contract/provider/v1"
	providercatalogbinding "code-code.internal/platform-k8s/internal/providercatalogbinding"
	provideraggregates "code-code.internal/platform-k8s/providers"
	"google.golang.org/protobuf/proto"
)

const catalogBindingPageSize = 100

type BindingSyncer struct {
	providers provideraggregates.Store
	registry  Registry
	logger    *slog.Logger
}

type Registry interface {
	List(context.Context, *modelservicev1.ListModelDefinitionsRequest) (*modelservicev1.ListModelDefinitionsResponse, error)
}

func NewBindingSyncer(providers provideraggregates.Store, registry Registry, logger *slog.Logger) *BindingSyncer {
	if logger == nil {
		logger = slog.Default()
	}
	return &BindingSyncer{
		providers: providers,
		registry:  registry,
		logger:    logger,
	}
}

func (s *BindingSyncer) SyncAll(ctx context.Context) error {
	if s == nil || s.providers == nil || s.registry == nil {
		return nil
	}
	providers, err := s.providers.List(ctx)
	if err != nil {
		return err
	}
	indexByVendor := map[string]*providercatalogbinding.Index{}
	for _, provider := range providers {
		updates, changed, err := s.bindProvider(ctx, provider, indexByVendor)
		if err != nil {
			return err
		}
		if !changed {
			continue
		}
		_, err = s.providers.Update(ctx, provider.GetProviderId(), func(next *providerv1.Provider) error {
			applyCatalogBindings(next, updates)
			return nil
		})
		if err != nil {
			return fmt.Errorf("platformk8s/providercatalogs: update provider %q catalog bindings: %w", provider.GetProviderId(), err)
		}
	}
	return nil
}

type surfaceCatalogBinding struct {
	surfaceID string
	catalog   *providerv1.ProviderModelCatalog
}

func (s *BindingSyncer) bindProvider(
	ctx context.Context,
	provider *providerv1.Provider,
	indexByVendor map[string]*providercatalogbinding.Index,
) ([]surfaceCatalogBinding, bool, error) {
	if provider == nil {
		return nil, false, nil
	}
	updates := make([]surfaceCatalogBinding, 0, len(provider.GetSurfaces()))
	for _, surface := range provider.GetSurfaces() {
		catalog := surface.GetRuntime().GetCatalog()
		vendorID := catalogOwnerVendorID(surface)
		if catalog == nil || vendorID == "" {
			continue
		}
		index := indexByVendor[vendorID]
		if index == nil {
			loaded, err := s.loadVendorIndex(ctx, vendorID)
			if err != nil {
				return nil, false, err
			}
			index = loaded
			indexByVendor[vendorID] = index
		}
		nextCatalog, changed := providercatalogbinding.BindCatalog(
			catalog,
			index,
			catalogBindingPolicyForVendor(vendorID),
		)
		if !changed {
			continue
		}
		updates = append(updates, surfaceCatalogBinding{
			surfaceID: strings.TrimSpace(surface.GetSurfaceId()),
			catalog:   nextCatalog,
		})
	}
	return updates, len(updates) > 0, nil
}

func (s *BindingSyncer) loadVendorIndex(ctx context.Context, vendorID string) (*providercatalogbinding.Index, error) {
	rows := make([]providercatalogbinding.RegistryRow, 0)
	pageToken := ""
	for {
		result, err := s.registry.List(ctx, &modelservicev1.ListModelDefinitionsRequest{
			PageSize:  catalogBindingPageSize,
			Filter:    "vendor_id=" + vendorID,
			PageToken: pageToken,
		})
		if err != nil {
			return nil, fmt.Errorf("platformk8s/providercatalogs: list registry models for %q: %w", vendorID, err)
		}
		for _, item := range result.Items {
			row := catalogBindingRegistryRow(item)
			if row.Definition == nil {
				continue
			}
			rows = append(rows, row)
		}
		pageToken = strings.TrimSpace(result.GetNextPageToken())
		if pageToken == "" {
			break
		}
	}
	return providercatalogbinding.NewIndex(rows), nil
}

func catalogBindingRegistryRow(item *modelservicev1.ModelRegistryEntry) providercatalogbinding.RegistryRow {
	if item == nil || item.GetDefinition() == nil {
		return providercatalogbinding.RegistryRow{}
	}
	row := providercatalogbinding.RegistryRow{
		Definition: item.GetDefinition(),
		Sources:    make([]providercatalogbinding.RegistrySource, 0, len(item.GetSources())),
	}
	for _, source := range item.GetSources() {
		if source == nil {
			continue
		}
		row.Sources = append(row.Sources, providercatalogbinding.RegistrySource{
			IsDirect:      source.GetIsDirect(),
			SourceModelID: source.GetSourceModelId(),
		})
	}
	return row
}

func catalogBindingPolicyForVendor(vendorID string) providercatalogbinding.CatalogPolicy {
	if strings.TrimSpace(vendorID) == "modelscope" {
		return providercatalogbinding.CatalogPolicy{DropUnbound: true}
	}
	return providercatalogbinding.CatalogPolicy{}
}

func applyCatalogBindings(provider *providerv1.Provider, updates []surfaceCatalogBinding) {
	bySurfaceID := make(map[string]surfaceCatalogBinding, len(updates))
	for _, update := range updates {
		if strings.TrimSpace(update.surfaceID) != "" {
			bySurfaceID[strings.TrimSpace(update.surfaceID)] = update
		}
	}
	for _, surface := range provider.GetSurfaces() {
		if surface == nil || surface.GetRuntime() == nil {
			continue
		}
		update, ok := bySurfaceID[strings.TrimSpace(surface.GetSurfaceId())]
		if !ok {
			continue
		}
		runtime := proto.Clone(surface.GetRuntime()).(*providerv1.ProviderSurfaceRuntime)
		runtime.Catalog = update.catalog
		surface.Runtime = runtime
	}
}

func catalogOwnerVendorID(surface *providerv1.ProviderSurfaceBinding) string {
	if surface.GetSourceRef().GetKind() != providerv1.ProviderSurfaceSourceKind_PROVIDER_SURFACE_SOURCE_KIND_VENDOR {
		return ""
	}
	return strings.TrimSpace(surface.GetSourceRef().GetId())
}
