package models

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
)

const defaultGitHubModelsURL = "https://models.github.ai/catalog/models"

type githubModelsCatalogModel struct {
	ID                        string   `json:"id"`
	Name                      string   `json:"name"`
	SupportedInputModalities  []string `json:"supported_input_modalities"`
	SupportedOutputModalities []string `json:"supported_output_modalities"`
	Capabilities              []string `json:"capabilities"`
	Limits                    struct {
		MaxInputTokens  int64 `json:"max_input_tokens"`
		MaxOutputTokens int64 `json:"max_output_tokens"`
	} `json:"limits"`
}

func fetchGitHubModels(ctx context.Context, httpClient *http.Client, endpoint string) ([]githubModelsCatalogModel, error) {
	if httpClient == nil {
		return nil, fmt.Errorf("platformk8s/models: github models http client is nil")
	}
	endpoint = strings.TrimSpace(endpoint)
	if endpoint == "" {
		endpoint = defaultGitHubModelsURL
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("platformk8s/models: build github models request: %w", err)
	}
	request.Header.Set("Accept", "application/json")
	request.Header.Set("User-Agent", "code-code-platform-k8s-models")

	response, err := httpClient.Do(request)
	if err != nil {
		return nil, fmt.Errorf("platformk8s/models: request github models: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("platformk8s/models: github models status %d", response.StatusCode)
	}

	var payload []githubModelsCatalogModel
	if err := json.NewDecoder(response.Body).Decode(&payload); err != nil {
		return nil, fmt.Errorf("platformk8s/models: decode github models: %w", err)
	}
	return payload, nil
}
