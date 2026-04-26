package models

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
)

const (
	defaultHuggingFaceModelsURL = "https://huggingface.co/api/models"
	huggingFacePageSize         = "100"
)

type huggingFaceModel struct {
	ID          string   `json:"id"`
	ModelID     string   `json:"modelId"`
	PipelineTag string   `json:"pipeline_tag"`
	Tags        []string `json:"tags"`
}

func fetchHuggingFaceModels(ctx context.Context, httpClient *http.Client, endpoint string, author string) ([]huggingFaceModel, error) {
	if httpClient == nil {
		return nil, fmt.Errorf("platformk8s/models: huggingface http client is nil")
	}
	author = strings.TrimSpace(author)
	if author == "" {
		return nil, nil
	}
	nextURL, err := buildHuggingFaceModelsURL(endpoint, author)
	if err != nil {
		return nil, err
	}

	var out []huggingFaceModel
	for nextURL != "" {
		request, err := http.NewRequestWithContext(ctx, http.MethodGet, nextURL, nil)
		if err != nil {
			return nil, fmt.Errorf("platformk8s/models: build huggingface models request: %w", err)
		}
		request.Header.Set("Accept", "application/json")
		request.Header.Set("User-Agent", "code-code-platform-k8s-models")

		response, err := httpClient.Do(request)
		if err != nil {
			return nil, fmt.Errorf("platformk8s/models: request huggingface models: %w", err)
		}
		var page []huggingFaceModel
		decodeErr := json.NewDecoder(response.Body).Decode(&page)
		response.Body.Close()
		if response.StatusCode != http.StatusOK {
			return nil, fmt.Errorf("platformk8s/models: huggingface models status %d", response.StatusCode)
		}
		if decodeErr != nil {
			return nil, fmt.Errorf("platformk8s/models: decode huggingface models: %w", decodeErr)
		}
		out = append(out, page...)
		nextURL = nextLinkURL(response.Header.Get("Link"))
	}
	return out, nil
}

func buildHuggingFaceModelsURL(endpoint string, author string) (string, error) {
	endpoint = strings.TrimSpace(endpoint)
	if endpoint == "" {
		endpoint = defaultHuggingFaceModelsURL
	}
	parsed, err := url.Parse(endpoint)
	if err != nil {
		return "", fmt.Errorf("platformk8s/models: parse huggingface models endpoint: %w", err)
	}
	query := parsed.Query()
	query.Set("author", strings.TrimSpace(author))
	query.Set("pipeline_tag", "text-generation")
	query.Set("limit", huggingFacePageSize)
	parsed.RawQuery = query.Encode()
	return parsed.String(), nil
}

func nextLinkURL(linkHeader string) string {
	for _, part := range strings.Split(strings.TrimSpace(linkHeader), ",") {
		part = strings.TrimSpace(part)
		if !strings.Contains(part, `rel="next"`) {
			continue
		}
		start := strings.Index(part, "<")
		end := strings.Index(part, ">")
		if start >= 0 && end > start+1 {
			return strings.TrimSpace(part[start+1 : end])
		}
	}
	return ""
}
