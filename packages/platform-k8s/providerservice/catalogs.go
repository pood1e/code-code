package providerservice

import (
	"context"
	"fmt"

	modelservicev1 "code-code.internal/go-contract/platform/model/v1"
)

type modelCatalogClient struct {
	client modelservicev1.ModelServiceClient
}

func (c modelCatalogClient) GetOrFetchCatalogModels(ctx context.Context, request *modelservicev1.GetOrFetchCatalogModelsRequest) ([]*modelservicev1.CatalogModel, error) {
	if c.client == nil {
		return nil, fmt.Errorf("platformk8s/providerservice: model service client is nil")
	}
	response, err := c.client.GetOrFetchCatalogModels(ctx, request)
	if err != nil {
		return nil, err
	}
	return response.GetModels(), nil
}

type modelRegistryClient struct {
	client modelservicev1.ModelServiceClient
}

func (c modelRegistryClient) List(ctx context.Context, request *modelservicev1.ListModelDefinitionsRequest) (*modelservicev1.ListModelDefinitionsResponse, error) {
	if c.client == nil {
		return nil, fmt.Errorf("platformk8s/providerservice: model service client is nil")
	}
	response, err := c.client.ListModelDefinitions(ctx, request)
	if err != nil {
		return nil, err
	}
	return response, nil
}
