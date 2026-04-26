package models

import (
	"context"
	"fmt"
	"strings"

	modelv1 "code-code.internal/go-contract/model/v1"
	modelservicev1 "code-code.internal/go-contract/platform/model/v1"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	defaultListPageSize = 50
	maxListPageSize     = 100
)

type ManagementService struct {
	postgres *PostgresManagementService
}

func NewManagementService(pool *pgxpool.Pool, namespace string) (*ManagementService, error) {
	postgres, err := NewPostgresManagementService(pool, namespace)
	if err != nil {
		return nil, err
	}
	return &ManagementService{postgres: postgres}, nil
}

func (s *ManagementService) List(ctx context.Context, request *modelservicev1.ListModelDefinitionsRequest) (*modelservicev1.ListModelDefinitionsResponse, error) {
	if s == nil || s.postgres == nil {
		return nil, fmt.Errorf("platformk8s/models: management service is not initialized")
	}
	return s.postgres.List(ctx, request)
}

func parseFilterValues(raw string) []string {
	parts := strings.Split(raw, ",")
	values := make([]string, 0, len(parts))
	seen := map[string]struct{}{}
	for _, part := range parts {
		value := strings.TrimSpace(part)
		if value == "" {
			continue
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		values = append(values, value)
	}
	return values
}

func applyCreateDefaults(definition *modelv1.ModelDefinition) {
	if definition.PrimaryShape == modelv1.ModelShape_MODEL_SHAPE_UNSPECIFIED {
		definition.PrimaryShape = modelv1.ModelShape_MODEL_SHAPE_CHAT_COMPLETIONS
	}
	if len(definition.SupportedShapes) == 0 {
		definition.SupportedShapes = []modelv1.ModelShape{definition.PrimaryShape}
	}
	if len(definition.InputModalities) == 0 {
		definition.InputModalities = []modelv1.Modality{modelv1.Modality_MODALITY_TEXT}
	}
	if len(definition.OutputModalities) == 0 {
		definition.OutputModalities = []modelv1.Modality{modelv1.Modality_MODALITY_TEXT}
	}
}

func normalizePageSize(pageSize int32) int {
	if pageSize <= 0 {
		return defaultListPageSize
	}
	if pageSize > maxListPageSize {
		return maxListPageSize
	}
	return int(pageSize)
}
