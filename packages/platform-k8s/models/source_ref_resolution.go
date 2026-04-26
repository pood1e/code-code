package models

import (
	"strings"

	modelv1 "code-code.internal/go-contract/model/v1"
)

type directDefinitionSourceRefResolver struct {
	exact map[string]*modelv1.ModelRef
	alias map[string]*modelv1.ModelRef
}

func newDirectDefinitionSourceRefResolver(snapshot *collectedDefinitionsSnapshot) *directDefinitionSourceRefResolver {
	resolver := &directDefinitionSourceRefResolver{
		exact: map[string]*modelv1.ModelRef{},
		alias: map[string]*modelv1.ModelRef{},
	}
	if snapshot == nil {
		return resolver
	}
	for _, item := range snapshot.definitions {
		if item.definition == nil || item.sourceRef != nil {
			continue
		}
		ref := refForDefinition(item.definition)
		if ref == nil {
			continue
		}
		resolver.exact[identityKey(ref.GetVendorId(), ref.GetModelId())] = ref
		for _, alias := range collectDefinitionAliases(item.definition) {
			resolver.bindAlias(identityKey(ref.GetVendorId(), alias), ref)
		}
	}
	return resolver
}

func (r *directDefinitionSourceRefResolver) resolve(ref *modelv1.ModelRef) (*modelv1.ModelRef, bool) {
	if r == nil || ref == nil {
		return nil, false
	}
	key := identityKey(ref.GetVendorId(), ref.GetModelId())
	if key == "" {
		return nil, false
	}
	if exact, ok := r.exact[key]; ok && exact != nil {
		return cloneModelRef(exact), true
	}
	if alias, ok := r.alias[key]; ok && alias != nil {
		return cloneModelRef(alias), true
	}
	return nil, false
}

func (r *directDefinitionSourceRefResolver) bindAlias(key string, ref *modelv1.ModelRef) {
	if r == nil || ref == nil || strings.TrimSpace(key) == "" {
		return
	}
	current, ok := r.alias[key]
	if !ok {
		r.alias[key] = cloneModelRef(ref)
		return
	}
	if current == nil {
		return
	}
	if current.GetVendorId() == ref.GetVendorId() && current.GetModelId() == ref.GetModelId() {
		return
	}
	r.alias[key] = nil
}
