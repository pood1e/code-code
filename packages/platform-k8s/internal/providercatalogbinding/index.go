package providercatalogbinding

import (
	"strings"

	modelv1 "code-code.internal/go-contract/model/v1"
)

type RegistrySource struct {
	IsDirect      bool
	SourceModelID string
}

type RegistryRow struct {
	Definition *modelv1.ModelDefinition
	Sources    []RegistrySource
}

type Index struct {
	byCanonicalModelID map[string]*modelv1.ModelRef
	bySourceModelID    map[string]*modelv1.ModelRef
	hasBindings        bool
}

func NewIndex(rows []RegistryRow) *Index {
	index := &Index{
		byCanonicalModelID: map[string]*modelv1.ModelRef{},
		bySourceModelID:    map[string]*modelv1.ModelRef{},
	}
	for _, row := range rows {
		definition := row.Definition
		if definition == nil {
			continue
		}
		ref := &modelv1.ModelRef{
			VendorId: strings.TrimSpace(definition.GetVendorId()),
			ModelId:  strings.TrimSpace(definition.GetModelId()),
		}
		if ref.GetVendorId() == "" || ref.GetModelId() == "" {
			continue
		}
		index.hasBindings = true
		bindUniqueModelRef(index.byCanonicalModelID, ref.GetModelId(), ref)
		for _, source := range row.Sources {
			if !source.IsDirect {
				continue
			}
			bindUniqueModelRef(index.bySourceModelID, source.SourceModelID, ref)
		}
	}
	return index
}

func (i *Index) HasBindings() bool {
	return i != nil && i.hasBindings
}

func (i *Index) Lookup(providerModelID string) *modelv1.ModelRef {
	if i == nil {
		return nil
	}
	providerModelID = strings.TrimSpace(providerModelID)
	if providerModelID == "" {
		return nil
	}
	if ref := cloneIndexedModelRef(i.byCanonicalModelID, providerModelID); ref != nil {
		return ref
	}
	return cloneIndexedModelRef(i.bySourceModelID, providerModelID)
}

func bindUniqueModelRef(index map[string]*modelv1.ModelRef, key string, ref *modelv1.ModelRef) {
	key = strings.TrimSpace(key)
	if key == "" || ref == nil {
		return
	}
	if current, ok := index[key]; !ok {
		index[key] = cloneModelRef(ref)
		return
	} else if current == nil {
		return
	} else if current.GetVendorId() == ref.GetVendorId() && current.GetModelId() == ref.GetModelId() {
		return
	}
	index[key] = nil
}

func cloneIndexedModelRef(index map[string]*modelv1.ModelRef, key string) *modelv1.ModelRef {
	if index == nil {
		return nil
	}
	ref := index[strings.TrimSpace(key)]
	if ref == nil {
		return nil
	}
	return cloneModelRef(ref)
}

func cloneModelRef(ref *modelv1.ModelRef) *modelv1.ModelRef {
	if ref == nil {
		return nil
	}
	return &modelv1.ModelRef{
		VendorId: ref.GetVendorId(),
		ModelId:  ref.GetModelId(),
	}
}
