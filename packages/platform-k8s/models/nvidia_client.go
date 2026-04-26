package models

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
)

const defaultNVIDIAModelsURL = "https://integrate.api.nvidia.com/v1/models"

type nvidiaModelsResponse struct {
	Data []nvidiaModel `json:"data"`
}

type nvidiaModel struct {
	ID      string `json:"id"`
	OwnedBy string `json:"owned_by"`
}

func fetchNVIDIAModels(ctx context.Context, httpClient *http.Client, endpoint string) ([]nvidiaModel, error) {
	if httpClient == nil {
		return nil, fmt.Errorf("platformk8s/models: nvidia integrate http client is nil")
	}
	endpoint = strings.TrimSpace(endpoint)
	if endpoint == "" {
		endpoint = defaultNVIDIAModelsURL
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("platformk8s/models: build nvidia integrate request: %w", err)
	}
	request.Header.Set("Accept", "application/json")
	request.Header.Set("User-Agent", "code-code-platform-k8s-models")

	response, err := httpClient.Do(request)
	if err != nil {
		return nil, fmt.Errorf("platformk8s/models: request nvidia integrate models: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("platformk8s/models: nvidia integrate models status %d", response.StatusCode)
	}

	payload := &nvidiaModelsResponse{}
	if err := json.NewDecoder(response.Body).Decode(payload); err != nil {
		return nil, fmt.Errorf("platformk8s/models: decode nvidia integrate models: %w", err)
	}
	return payload.Data, nil
}
