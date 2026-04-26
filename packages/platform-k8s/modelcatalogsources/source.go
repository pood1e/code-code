package modelcatalogsources

import (
	"context"

	modelservicev1 "code-code.internal/go-contract/platform/model/v1"
)

type Source interface {
	CapabilityRef() CapabilityRef
	ListModels(context.Context, *modelservicev1.FetchCatalogModelsRequest) ([]*modelservicev1.CatalogModel, error)
}
