package models

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
)

const defaultModelScopeModelsURL = "https://api-inference.modelscope.cn/v1/models"

type modelScopeModelsResponse struct {
	Data []modelScopeModel `json:"data"`
}

type modelScopeModel struct {
	ID      string `json:"id"`
	Created int64  `json:"created"`
}

func fetchModelScopeModels(ctx context.Context, httpClient *http.Client, endpoint string) ([]modelScopeModel, error) {
	if httpClient == nil {
		return nil, fmt.Errorf("platformk8s/models: modelscope http client is nil")
	}
	endpoint = strings.TrimSpace(endpoint)
	if endpoint == "" {
		endpoint = defaultModelScopeModelsURL
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("platformk8s/models: build modelscope request: %w", err)
	}
	request.Header.Set("Accept", "application/json")
	request.Header.Set("User-Agent", "code-code-platform-k8s-models")

	response, err := httpClient.Do(request)
	if err != nil {
		return nil, fmt.Errorf("platformk8s/models: request modelscope models: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("platformk8s/models: modelscope models status %d", response.StatusCode)
	}

	payload := &modelScopeModelsResponse{}
	if err := json.NewDecoder(response.Body).Decode(payload); err != nil {
		return nil, fmt.Errorf("platformk8s/models: decode modelscope models: %w", err)
	}
	return payload.Data, nil
}
