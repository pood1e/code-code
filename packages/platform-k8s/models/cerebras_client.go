package models

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
)

const defaultCerebrasModelsURL = "https://api.cerebras.ai/public/v1/models"

type cerebrasModelsResponse struct {
	Data []cerebrasModel `json:"data"`
}

type cerebrasModel struct {
	ID            string `json:"id"`
	OwnedBy       string `json:"owned_by"`
	Name          string `json:"name"`
	HuggingFaceID string `json:"hugging_face_id"`
	Pricing       struct {
		Prompt     string `json:"prompt"`
		Completion string `json:"completion"`
	} `json:"pricing"`
	Capabilities struct {
		FunctionCalling   bool `json:"function_calling"`
		StructuredOutputs bool `json:"structured_outputs"`
		Vision            bool `json:"vision"`
		Reasoning         bool `json:"reasoning"`
	} `json:"capabilities"`
	Limits struct {
		MaxContextLength    int64 `json:"max_context_length"`
		MaxCompletionTokens int64 `json:"max_completion_tokens"`
	} `json:"limits"`
}

func fetchCerebrasModels(ctx context.Context, httpClient *http.Client, endpoint string) ([]cerebrasModel, error) {
	if httpClient == nil {
		return nil, fmt.Errorf("platformk8s/models: cerebras http client is nil")
	}
	endpoint = strings.TrimSpace(endpoint)
	if endpoint == "" {
		endpoint = defaultCerebrasModelsURL
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("platformk8s/models: build cerebras request: %w", err)
	}
	request.Header.Set("Accept", "application/json")
	request.Header.Set("User-Agent", "code-code-platform-k8s-models")

	response, err := httpClient.Do(request)
	if err != nil {
		return nil, fmt.Errorf("platformk8s/models: request cerebras models: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("platformk8s/models: cerebras models status %d", response.StatusCode)
	}

	payload := &cerebrasModelsResponse{}
	if err := json.NewDecoder(response.Body).Decode(payload); err != nil {
		return nil, fmt.Errorf("platformk8s/models: decode cerebras models: %w", err)
	}
	return payload.Data, nil
}
