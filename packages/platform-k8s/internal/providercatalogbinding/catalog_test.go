package providercatalogbinding

import (
	"testing"

	providerv1 "code-code.internal/go-contract/provider/v1"
	modelv1 "code-code.internal/go-contract/model/v1"
)

func TestBindCatalogSkipsEmptyIndex(t *testing.T) {
	t.Parallel()

	catalog := &providerv1.ProviderModelCatalog{
		Models: []*providerv1.ProviderModelCatalogEntry{
			{ProviderModelId: "deepseek-ai/DeepSeek-R1-0528"},
		},
	}
	next, changed := BindCatalog(catalog, NewIndex(nil), CatalogPolicy{DropUnbound: true})
	if changed {
		t.Fatal("changed = true, want false")
	}
	if next != nil {
		t.Fatalf("next = %#v, want nil", next)
	}
}

func TestBindCatalogDropsUnboundEntries(t *testing.T) {
	t.Parallel()

	catalog := &providerv1.ProviderModelCatalog{
		Models: []*providerv1.ProviderModelCatalogEntry{
			{ProviderModelId: "deepseek-ai/DeepSeek-R1-0528"},
			{ProviderModelId: "Qwen/QVQ-72B-Preview"},
		},
	}
	index := NewIndex([]RegistryRow{
		{
			Definition: &modelv1.ModelDefinition{
				VendorId: "modelscope",
				ModelId:  "deepseek-ai/DeepSeek-R1-0528",
			},
		},
	})
	next, changed := BindCatalog(catalog, index, CatalogPolicy{DropUnbound: true})
	if !changed {
		t.Fatal("changed = false, want true")
	}
	if got, want := len(next.GetModels()), 1; got != want {
		t.Fatalf("len(models) = %d, want %d", got, want)
	}
	if got, want := next.GetModels()[0].GetModelRef().GetVendorId(), "modelscope"; got != want {
		t.Fatalf("modelRef.vendorId = %q, want %q", got, want)
	}
}
