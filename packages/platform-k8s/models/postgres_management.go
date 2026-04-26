package models

import (
	"context"
	"fmt"
	"strings"

	modelv1 "code-code.internal/go-contract/model/v1"
	modelservicev1 "code-code.internal/go-contract/platform/model/v1"
	"github.com/jackc/pgx/v5/pgxpool"
)

// PostgresManagementService lists durable model registry entries owned by
// model-service. It does not expose Kubernetes resource shapes.
type PostgresManagementService struct {
	pool      *pgxpool.Pool
	namespace string
}

// NewPostgresManagementService creates a DB-backed model registry reader.
func NewPostgresManagementService(pool *pgxpool.Pool, namespace string) (*PostgresManagementService, error) {
	if pool == nil {
		return nil, fmt.Errorf("platformk8s/models: postgres pool is nil")
	}
	if strings.TrimSpace(namespace) == "" {
		return nil, fmt.Errorf("platformk8s/models: namespace is empty")
	}
	return &PostgresManagementService{pool: pool, namespace: strings.TrimSpace(namespace)}, nil
}

func (s *PostgresManagementService) List(ctx context.Context, request *modelservicev1.ListModelDefinitionsRequest) (*modelservicev1.ListModelDefinitionsResponse, error) {
	if request == nil {
		request = &modelservicev1.ListModelDefinitionsRequest{}
	}
	filter, err := parseDefinitionListFilter(request.GetFilter())
	if err != nil {
		return nil, err
	}
	pageSize := normalizePageSize(request.GetPageSize())
	_, offset := decodeDefinitionListPageToken(request.GetPageToken())
	if offset < 0 {
		offset = 0
	}
	predicate := newPostgresDefinitionListPredicate(s.namespace)
	if err := predicate.apply(filter); err != nil {
		return nil, err
	}
	whereSQL, whereArgs := predicate.where()

	listArgs := append([]any(nil), whereArgs...)
	limitParam := appendPostgresArg(&listArgs, int64(pageSize+1))
	offsetParam := appendPostgresArg(&listArgs, offset)
	rows, err := s.pool.Query(
		ctx,
		fmt.Sprintf(
			`select vendor_id, model_id, definition, source_ref_vendor_id, source_ref_model_id, badges, pricing
from %s
where %s
order by vendor_id, model_id
limit %s offset %s`,
			modelRegistryEntriesTable,
			whereSQL,
			limitParam,
			offsetParam,
		),
		listArgs...,
	)
	if err != nil {
		return nil, fmt.Errorf("platformk8s/models: list model registry entries: %w", err)
	}
	defer rows.Close()

	items := make([]*modelservicev1.ModelRegistryEntry, 0, pageSize+1)
	for rows.Next() {
		row, err := s.scanRegistryEntry(ctx, rows.Scan)
		if err != nil {
			return nil, err
		}
		items = append(items, row)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	hasMore := len(items) > pageSize
	if hasMore {
		items = items[:pageSize]
	}
	nextOffset := offset + int64(len(items))
	nextPageToken := ""
	if hasMore {
		nextPageToken = encodeDefinitionListOffsetPageToken(nextOffset)
	}
	return &modelservicev1.ListModelDefinitionsResponse{
		Items:         items,
		NextPageToken: nextPageToken,
		TotalCount:    estimateDefinitionListTotalCount(offset, int64(len(items)), nil, hasMore),
	}, nil
}

type postgresScanFunc func(...any) error

func (s *PostgresManagementService) scanRegistryEntry(ctx context.Context, scan postgresScanFunc) (*modelservicev1.ModelRegistryEntry, error) {
	var vendorID string
	var modelID string
	var rawDefinition []byte
	var sourceRefVendorID *string
	var sourceRefModelID *string
	var rawBadges []byte
	var rawPricing []byte
	if err := scan(&vendorID, &modelID, &rawDefinition, &sourceRefVendorID, &sourceRefModelID, &rawBadges, &rawPricing); err != nil {
		return nil, fmt.Errorf("platformk8s/models: scan model registry entry: %w", err)
	}
	definition, err := decodeModelDefinition(rawDefinition)
	if err != nil {
		return nil, err
	}
	badges, err := decodeStringSlice(rawBadges)
	if err != nil {
		return nil, err
	}
	pricing, err := decodePricing(rawPricing)
	if err != nil {
		return nil, err
	}
	var sourceRef *modelv1.ModelRef
	if sourceRefVendorID != nil || sourceRefModelID != nil {
		sourceRef = &modelv1.ModelRef{}
		if sourceRefVendorID != nil {
			sourceRef.VendorId = strings.TrimSpace(*sourceRefVendorID)
		}
		if sourceRefModelID != nil {
			sourceRef.ModelId = strings.TrimSpace(*sourceRefModelID)
		}
	}
	sources, err := s.listEntrySources(ctx, vendorID, modelID)
	if err != nil {
		return nil, err
	}
	return &modelservicev1.ModelRegistryEntry{
		Definition: definition,
		SourceRef:  sourceRef,
		Badges:     badges,
		Pricing:    protoDefinitionPricing(pricing),
		Sources:    sources,
	}, nil
}

func (s *PostgresManagementService) listEntrySources(ctx context.Context, vendorID string, modelID string) ([]*modelservicev1.RegistryModelSource, error) {
	rows, err := s.pool.Query(ctx, fmt.Sprintf(`
select source_id, is_direct, kind, source_model_id, definition, badges, pricing
from %s
where namespace = $1 and vendor_id = $2 and model_id = $3
order by is_direct desc, source_id, source_model_id`, modelRegistryObservationsTable), s.namespace, vendorID, modelID)
	if err != nil {
		return nil, fmt.Errorf("platformk8s/models: list model registry observations %q/%q: %w", vendorID, modelID, err)
	}
	defer rows.Close()

	out := []*modelservicev1.RegistryModelSource{}
	for rows.Next() {
		var sourceID string
		var isDirect bool
		var kind string
		var sourceModelID *string
		var rawDefinition []byte
		var rawBadges []byte
		var rawPricing []byte
		if err := rows.Scan(&sourceID, &isDirect, &kind, &sourceModelID, &rawDefinition, &rawBadges, &rawPricing); err != nil {
			return nil, fmt.Errorf("platformk8s/models: scan model registry observation: %w", err)
		}
		definition, err := decodeModelDefinition(rawDefinition)
		if err != nil {
			return nil, err
		}
		badges, err := decodeStringSlice(rawBadges)
		if err != nil {
			return nil, err
		}
		pricing, err := decodePricing(rawPricing)
		if err != nil {
			return nil, err
		}
		modelID := ""
		if sourceModelID != nil {
			modelID = *sourceModelID
		}
		out = append(out, normalizeRegistryModelSource(&modelservicev1.RegistryModelSource{
			SourceId:      sourceID,
			Kind:          kind,
			IsDirect:      isDirect,
			SourceModelId: modelID,
			Definition:    definition,
			Badges:        badges,
			Pricing:       protoDefinitionPricing(pricing),
		}))
	}
	return out, rows.Err()
}

type postgresDefinitionListPredicate struct {
	clauses []string
	args    []any
}

func newPostgresDefinitionListPredicate(namespace string) *postgresDefinitionListPredicate {
	p := &postgresDefinitionListPredicate{}
	p.add("namespace = " + p.arg(strings.TrimSpace(namespace)))
	return p
}

func (p *postgresDefinitionListPredicate) apply(filter *definitionListFilter) error {
	if filter == nil {
		return nil
	}
	if len(filter.vendorID) > 0 {
		p.add("vendor_id = any(" + p.arg(normalizeVendorIDs(filter.vendorID)) + "::text[])")
	}
	if strings.TrimSpace(filter.modelID) != "" {
		p.add("model_id = " + p.arg(strings.TrimSpace(filter.modelID)))
	}
	if filter.badge != "" {
		raw, err := encodeStringSlice([]string{filter.badge})
		if err != nil {
			return err
		}
		p.add("badges @> " + p.arg(string(raw)) + "::jsonb")
	}
	if filter.sourceRefNil {
		p.add("source_ref_vendor_id is null and source_ref_model_id is null")
	}
	if len(filter.sourceVendor) > 0 {
		p.add("source_ref_vendor_id = any(" + p.arg(normalizeVendorIDs(filter.sourceVendor)) + "::text[])")
	}
	if len(filter.sourceModel) > 0 {
		p.add("source_ref_model_id = any(" + p.arg(trimmedValues(filter.sourceModel)) + "::text[])")
	}
	if strings.TrimSpace(filter.modelIDQuery) != "" {
		p.add("lower(model_id) like " + p.arg(likeContainsPattern(filter.modelIDQuery)) + " escape '\\'")
	}
	if len(filter.sourceID) > 0 {
		p.add(fmt.Sprintf(`exists (
select 1 from %s observations
where observations.namespace = %s.namespace
  and observations.vendor_id = %s.vendor_id
  and observations.model_id = %s.model_id
  and observations.source_id = any(%s::text[])
)`, modelRegistryObservationsTable, modelRegistryEntriesTable, modelRegistryEntriesTable, modelRegistryEntriesTable, p.arg(normalizeDefinitionSourceIDs(filter.sourceID))))
	}
	return nil
}

func (p *postgresDefinitionListPredicate) add(clause string) {
	if strings.TrimSpace(clause) != "" {
		p.clauses = append(p.clauses, clause)
	}
}

func (p *postgresDefinitionListPredicate) arg(value any) string {
	p.args = append(p.args, value)
	return fmt.Sprintf("$%d", len(p.args))
}

func (p *postgresDefinitionListPredicate) where() (string, []any) {
	if len(p.clauses) == 0 {
		return "true", append([]any(nil), p.args...)
	}
	return strings.Join(p.clauses, " and "), append([]any(nil), p.args...)
}

func appendPostgresArg(args *[]any, value any) string {
	*args = append(*args, value)
	return fmt.Sprintf("$%d", len(*args))
}

func likeContainsPattern(value string) string {
	replacer := strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`)
	return "%" + replacer.Replace(strings.ToLower(strings.TrimSpace(value))) + "%"
}

func normalizeVendorIDs(values []string) []string {
	out := make([]string, 0, len(values))
	for _, value := range values {
		if normalized := normalizedVendorSlug(value); normalized != "" {
			out = append(out, normalized)
		}
	}
	return out
}

func trimmedValues(values []string) []string {
	out := make([]string, 0, len(values))
	for _, value := range values {
		if trimmed := strings.TrimSpace(value); trimmed != "" {
			out = append(out, trimmed)
		}
	}
	return out
}
