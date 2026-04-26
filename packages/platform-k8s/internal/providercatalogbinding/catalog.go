package providercatalogbinding

import (
	"strings"

	providerv1 "code-code.internal/go-contract/provider/v1"
	modelv1 "code-code.internal/go-contract/model/v1"
	"google.golang.org/protobuf/proto"
)

type CatalogPolicy struct {
	DropUnbound bool
}

func BindCatalog(
	catalog *providerv1.ProviderModelCatalog,
	index *Index,
	policy CatalogPolicy,
) (*providerv1.ProviderModelCatalog, bool) {
	if catalog == nil || len(catalog.GetModels()) == 0 || index == nil || !index.HasBindings() {
		return nil, false
	}
	next := proto.Clone(catalog).(*providerv1.ProviderModelCatalog)
	items := make([]*providerv1.ProviderModelCatalogEntry, 0, len(next.GetModels()))
	changed := false
	for _, item := range next.GetModels() {
		if item == nil {
			changed = true
			continue
		}
		ref := index.Lookup(item.GetProviderModelId())
		if ref == nil {
			if policy.DropUnbound {
				changed = true
				continue
			}
			items = append(items, item)
			continue
		}
		if !sameModelRef(item.GetModelRef(), ref) {
			item.ModelRef = ref
			changed = true
		}
		items = append(items, item)
	}
	if !changed {
		return nil, false
	}
	next.Models = items
	return next, true
}

func ResolveDefaultModelID(current string, catalog *providerv1.ProviderModelCatalog) string {
	current = strings.TrimSpace(current)
	if catalog == nil || len(catalog.GetModels()) == 0 {
		return ""
	}
	for _, item := range catalog.GetModels() {
		if strings.TrimSpace(item.GetProviderModelId()) == current {
			return current
		}
	}
	return strings.TrimSpace(catalog.GetModels()[0].GetProviderModelId())
}

func sameModelRef(left *modelv1.ModelRef, right *modelv1.ModelRef) bool {
	switch {
	case left == nil && right == nil:
		return true
	case left == nil || right == nil:
		return false
	default:
		return strings.TrimSpace(left.GetVendorId()) == strings.TrimSpace(right.GetVendorId()) &&
			strings.TrimSpace(left.GetModelId()) == strings.TrimSpace(right.GetModelId())
	}
}
