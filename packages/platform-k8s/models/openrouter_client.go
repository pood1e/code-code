package models

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	"github.com/OpenRouterTeam/go-sdk"
	"github.com/OpenRouterTeam/go-sdk/models/components"
)

const defaultOpenRouterModelsURL = "https://openrouter.ai/api/v1/models?output_modalities=text"

func fetchOpenRouterModels(ctx context.Context, httpClient *http.Client, endpoint string) ([]components.Model, error) {
	if httpClient == nil {
		return nil, fmt.Errorf("platformk8s/models: openrouter http client is nil")
	}

	opts := []openrouter.SDKOption{
		openrouter.WithClient(httpClient),
	}
	endpoint = strings.TrimSpace(endpoint)
	// If a custom endpoint is provided that isn't the legacy default full URL, we extract the base URL.
	// We check against the exact string which used to be the default to avoid breaking existing configurations.
	if endpoint != "" && endpoint != defaultOpenRouterModelsURL {
		// Attempt to extract base URL if the endpoint looks like a full URL
		// For example if they provided "https://custom.api/v1/models" we want "https://custom.api/v1"
		base := endpoint
		if strings.HasSuffix(base, "/models") {
			base = strings.TrimSuffix(base, "/models")
		} else if strings.Contains(base, "/models?") {
			parts := strings.SplitN(base, "/models?", 2)
			base = parts[0]
		}
		opts = append(opts, openrouter.WithServerURL(base))
	}

	client := openrouter.New(opts...)
	res, err := client.Models.List(ctx, nil, nil, nil)
	if err != nil {
		return nil, fmt.Errorf("platformk8s/models: request openrouter models: %w", err)
	}
	if res == nil {
		return nil, fmt.Errorf("platformk8s/models: openrouter models returned nil response")
	}

	return res.Data, nil
}
