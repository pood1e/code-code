package modelcatalogsources

import (
	"context"
	"fmt"

	modelservicev1 "code-code.internal/go-contract/platform/model/v1"
)

type Registry struct {
	sources map[string]Source
}

func NewRegistry() *Registry {
	return &Registry{sources: map[string]Source{}}
}

func (r *Registry) Register(source Source) error {
	if r == nil {
		return fmt.Errorf("platformk8s/modelcatalogsources: registry is nil")
	}
	if source == nil {
		return fmt.Errorf("platformk8s/modelcatalogsources: source is nil")
	}
	key, err := source.CapabilityRef().Key()
	if err != nil {
		return err
	}
	if _, exists := r.sources[key]; exists {
		return fmt.Errorf("platformk8s/modelcatalogsources: source %q is already registered", key)
	}
	r.sources[key] = source
	return nil
}

func (r *Registry) ListModels(ctx context.Context, ref CapabilityRef, request *modelservicev1.FetchCatalogModelsRequest) ([]*modelservicev1.CatalogModel, error) {
	if r == nil {
		return nil, fmt.Errorf("platformk8s/modelcatalogsources: registry is nil")
	}
	key, err := ref.Key()
	if err != nil {
		return nil, err
	}
	source := r.sources[key]
	if source == nil {
		return nil, fmt.Errorf("platformk8s/modelcatalogsources: source %q is not registered", key)
	}
	return source.ListModels(ctx, request)
}

func (r *Registry) Has(ref CapabilityRef) bool {
	if r == nil {
		return false
	}
	key, err := ref.Key()
	if err != nil {
		return false
	}
	return r.sources[key] != nil
}
