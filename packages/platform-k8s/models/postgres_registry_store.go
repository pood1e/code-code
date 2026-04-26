package models

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	modelv1 "code-code.internal/go-contract/model/v1"
	domaineventv1 "code-code.internal/go-contract/platform/domain_event/v1"
	modelservicev1 "code-code.internal/go-contract/platform/model/v1"
	"code-code.internal/platform-k8s/domainevents"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"
)

const (
	modelRegistryEntriesTable      = "platform_model_registry_entries"
	modelRegistryObservationsTable = "platform_model_registry_observations"
)

var modelDefinitionJSON = protojson.MarshalOptions{UseProtoNames: true}

func newPostgresRegistryStore(pool *pgxpool.Pool, outbox *domainevents.Outbox, namespace string) (*PostgresRegistryStore, error) {
	if pool == nil {
		return nil, fmt.Errorf("platformk8s/models: postgres pool is nil")
	}
	namespace = strings.TrimSpace(namespace)
	if namespace == "" {
		return nil, fmt.Errorf("platformk8s/models: namespace is empty")
	}
	return &PostgresRegistryStore{
		pool:      pool,
		outbox:    outbox,
		namespace: namespace,
	}, nil
}

func (s *PostgresRegistryStore) ListManagedDefinitions(ctx context.Context) ([]storedDefinition, error) {
	rows, err := s.pool.Query(ctx, fmt.Sprintf(`
select vendor_id, model_id, definition
from %s
where namespace = $1
order by vendor_id, model_id`, modelRegistryEntriesTable), s.namespace)
	if err != nil {
		return nil, fmt.Errorf("platformk8s/models: list managed model registry entries: %w", err)
	}
	defer rows.Close()

	out := []storedDefinition{}
	for rows.Next() {
		var vendorID string
		var modelID string
		var rawDefinition []byte
		if err := rows.Scan(&vendorID, &modelID, &rawDefinition); err != nil {
			return nil, fmt.Errorf("platformk8s/models: scan model registry entry: %w", err)
		}
		definition, err := decodeModelDefinition(rawDefinition)
		if err != nil {
			return nil, err
		}
		identity, err := newSurfaceIdentity(vendorID, modelID)
		if err != nil {
			return nil, err
		}
		out = append(out, storedDefinition{Identity: identity, Definition: definition})
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return out, nil
}

func (s *PostgresRegistryStore) UpsertManagedDefinition(ctx context.Context, entry *modelservicev1.ModelRegistryEntry) error {
	if entry == nil {
		return fmt.Errorf("platformk8s/models: model registry entry is nil")
	}
	identity, err := identityFromDefinition(entry.GetDefinition())
	if err != nil {
		return err
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	generation, mutation, err := s.nextGeneration(ctx, tx, identity)
	if err != nil {
		return err
	}
	definitionJSON, err := encodeModelDefinition(entry.GetDefinition())
	if err != nil {
		return err
	}
	badgesJSON, err := encodeStringSlice(entry.GetBadges())
	if err != nil {
		return err
	}
	pricingJSON, err := encodePricing(definitionSourcePricingFromProto(entry.GetPricing()))
	if err != nil {
		return err
	}
	sourceRefVendorID := ""
	sourceRefModelID := ""
	if entry.GetSourceRef() != nil {
		sourceRefVendorID = strings.TrimSpace(entry.GetSourceRef().GetVendorId())
		sourceRefModelID = strings.TrimSpace(entry.GetSourceRef().GetModelId())
	}

	if mutation == "created" {
		if _, err := tx.Exec(ctx, fmt.Sprintf(`
insert into %s (
	namespace, vendor_id, model_id, definition, source_ref_vendor_id,
	source_ref_model_id, badges, pricing, generation, created_at, updated_at
) values ($1, $2, $3, $4::jsonb, nullif($5, ''), nullif($6, ''), $7::jsonb, $8::jsonb, $9, now(), now())`,
			modelRegistryEntriesTable),
			s.namespace, identity.vendorID, identity.modelID, string(definitionJSON),
			sourceRefVendorID, sourceRefModelID, string(badgesJSON), string(pricingJSON), generation,
		); err != nil {
			return fmt.Errorf("platformk8s/models: insert model registry entry %q/%q: %w", identity.vendorID, identity.modelID, err)
		}
	} else {
		if _, err := tx.Exec(ctx, fmt.Sprintf(`
update %s
set definition = $4::jsonb,
    source_ref_vendor_id = nullif($5, ''),
    source_ref_model_id = nullif($6, ''),
    badges = $7::jsonb,
    pricing = $8::jsonb,
    generation = $9,
    updated_at = now()
where namespace = $1 and vendor_id = $2 and model_id = $3`,
			modelRegistryEntriesTable),
			s.namespace, identity.vendorID, identity.modelID, string(definitionJSON),
			sourceRefVendorID, sourceRefModelID, string(badgesJSON), string(pricingJSON), generation,
		); err != nil {
			return fmt.Errorf("platformk8s/models: update model registry entry %q/%q: %w", identity.vendorID, identity.modelID, err)
		}
	}
	if err := s.replaceObservations(ctx, tx, identity, entry.GetSources()); err != nil {
		return err
	}
	if err := s.enqueueModelDefinitionEvent(ctx, tx, entry.GetDefinition(), mutation, generation); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (s *PostgresRegistryStore) DeleteManagedDefinition(ctx context.Context, identity surfaceIdentity) error {
	if strings.TrimSpace(identity.vendorID) == "" || strings.TrimSpace(identity.modelID) == "" {
		return nil
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	definition, generation, err := s.getDefinitionForUpdate(ctx, tx, identity)
	if err == pgx.ErrNoRows {
		return nil
	}
	if err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, fmt.Sprintf(`
delete from %s where namespace = $1 and vendor_id = $2 and model_id = $3`,
		modelRegistryObservationsTable), s.namespace, identity.vendorID, identity.modelID); err != nil {
		return fmt.Errorf("platformk8s/models: delete model registry observations %q/%q: %w", identity.vendorID, identity.modelID, err)
	}
	if _, err := tx.Exec(ctx, fmt.Sprintf(`
delete from %s where namespace = $1 and vendor_id = $2 and model_id = $3`,
		modelRegistryEntriesTable), s.namespace, identity.vendorID, identity.modelID); err != nil {
		return fmt.Errorf("platformk8s/models: delete model registry entry %q/%q: %w", identity.vendorID, identity.modelID, err)
	}
	if err := s.enqueueModelDefinitionEvent(ctx, tx, definition, "deleted", generation); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (s *PostgresRegistryStore) nextGeneration(ctx context.Context, tx pgx.Tx, identity surfaceIdentity) (int64, string, error) {
	_, generation, err := s.getDefinitionForUpdate(ctx, tx, identity)
	if err == pgx.ErrNoRows {
		return 1, "created", nil
	}
	if err != nil {
		return 0, "", err
	}
	return generation + 1, "updated", nil
}

func (s *PostgresRegistryStore) getDefinitionForUpdate(ctx context.Context, tx pgx.Tx, identity surfaceIdentity) (*modelv1.ModelDefinition, int64, error) {
	var rawDefinition []byte
	var generation int64
	if err := tx.QueryRow(ctx, fmt.Sprintf(`
select definition, generation
from %s
where namespace = $1 and vendor_id = $2 and model_id = $3
for update`, modelRegistryEntriesTable), s.namespace, identity.vendorID, identity.modelID).Scan(&rawDefinition, &generation); err != nil {
		return nil, 0, err
	}
	definition, err := decodeModelDefinition(rawDefinition)
	if err != nil {
		return nil, 0, err
	}
	return definition, generation, nil
}

func (s *PostgresRegistryStore) replaceObservations(ctx context.Context, tx pgx.Tx, identity surfaceIdentity, observations []*modelservicev1.RegistryModelSource) error {
	if _, err := tx.Exec(ctx, fmt.Sprintf(`
delete from %s where namespace = $1 and vendor_id = $2 and model_id = $3`,
		modelRegistryObservationsTable), s.namespace, identity.vendorID, identity.modelID); err != nil {
		return fmt.Errorf("platformk8s/models: delete model registry observations %q/%q: %w", identity.vendorID, identity.modelID, err)
	}
	for _, observation := range normalizeRegistryObservations(observations) {
		if observation.GetSourceId() == "" {
			continue
		}
		definitionJSON, err := encodeModelDefinition(observation.GetDefinition())
		if err != nil {
			return err
		}
		badgesJSON, err := encodeStringSlice(observation.GetBadges())
		if err != nil {
			return err
		}
		pricingJSON, err := encodePricing(definitionSourcePricingFromProto(observation.GetPricing()))
		if err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, fmt.Sprintf(`
insert into %s (
	namespace, vendor_id, model_id, source_id, is_direct, kind,
	source_model_id, definition, badges, pricing, created_at, updated_at
) values ($1, $2, $3, $4, $5, $6, nullif($7, ''), $8::jsonb, $9::jsonb, $10::jsonb, now(), now())`,
			modelRegistryObservationsTable),
			s.namespace, identity.vendorID, identity.modelID, observation.GetSourceId(),
			observation.GetIsDirect(), observation.GetKind(), observation.GetSourceModelId(),
			string(definitionJSON), string(badgesJSON), string(pricingJSON),
		); err != nil {
			return fmt.Errorf("platformk8s/models: insert model registry observation %q/%q/%q: %w", identity.vendorID, identity.modelID, observation.GetSourceId(), err)
		}
	}
	return nil
}

func normalizeRegistryObservations(observations []*modelservicev1.RegistryModelSource) []*modelservicev1.RegistryModelSource {
	if len(observations) == 0 {
		return nil
	}
	out := make([]*modelservicev1.RegistryModelSource, 0, len(observations))
	seen := map[string]struct{}{}
	for _, observation := range observations {
		normalized := normalizeRegistryModelSource(observation)
		if normalized == nil || normalized.GetSourceId() == "" {
			continue
		}
		key := normalized.GetSourceId() + "\x00" + boolKey(normalized.GetIsDirect())
		if _, exists := seen[key]; exists {
			continue
		}
		seen[key] = struct{}{}
		out = append(out, normalized)
	}
	return out
}

func (s *PostgresRegistryStore) enqueueModelDefinitionEvent(ctx context.Context, tx pgx.Tx, definition *modelv1.ModelDefinition, mutation string, generation int64) error {
	if s.outbox == nil {
		return nil
	}
	identity, err := identityFromDefinition(definition)
	if err != nil {
		return err
	}
	event := &domaineventv1.DomainEvent{
		EventType:        mutation,
		AggregateType:    "catalog",
		AggregateId:      identity.vendorID + "/" + identity.modelID,
		AggregateVersion: generation,
		Payload: &domaineventv1.DomainEvent_Catalog{Catalog: &domaineventv1.CatalogEvent{
			Mutation:  modelDefinitionDomainMutation(mutation),
			Kind:      domaineventv1.CatalogKind_CATALOG_KIND_MODEL_DEFINITION,
			CatalogId: identity.vendorID + "/" + identity.modelID,
			Definition: &domaineventv1.CatalogEvent_ModelDefinition{
				ModelDefinition: proto.Clone(definition).(*modelv1.ModelDefinition),
			},
		}},
	}
	return s.outbox.EnqueueTx(ctx, tx, event)
}

func modelDefinitionDomainMutation(mutation string) domaineventv1.DomainMutation {
	switch strings.TrimSpace(mutation) {
	case "created":
		return domaineventv1.DomainMutation_DOMAIN_MUTATION_CREATED
	case "deleted":
		return domaineventv1.DomainMutation_DOMAIN_MUTATION_DELETED
	default:
		return domaineventv1.DomainMutation_DOMAIN_MUTATION_UPDATED
	}
}

func encodeModelDefinition(definition *modelv1.ModelDefinition) ([]byte, error) {
	if definition == nil {
		return []byte("null"), nil
	}
	raw, err := modelDefinitionJSON.Marshal(definition)
	if err != nil {
		return nil, fmt.Errorf("platformk8s/models: encode model definition: %w", err)
	}
	return raw, nil
}

func decodeModelDefinition(raw []byte) (*modelv1.ModelDefinition, error) {
	definition := &modelv1.ModelDefinition{}
	if len(raw) == 0 || string(raw) == "null" {
		return definition, nil
	}
	if err := protojson.Unmarshal(raw, definition); err != nil {
		return nil, fmt.Errorf("platformk8s/models: decode model definition: %w", err)
	}
	return definition, nil
}

func encodeStringSlice(values []string) ([]byte, error) {
	raw, err := json.Marshal(normalizeDefinitionSourceBadges(values))
	if err != nil {
		return nil, fmt.Errorf("platformk8s/models: encode string slice: %w", err)
	}
	return raw, nil
}

func decodeStringSlice(raw []byte) ([]string, error) {
	if len(raw) == 0 || string(raw) == "null" {
		return nil, nil
	}
	var values []string
	if err := json.Unmarshal(raw, &values); err != nil {
		return nil, fmt.Errorf("platformk8s/models: decode string slice: %w", err)
	}
	return normalizeDefinitionSourceBadges(values), nil
}

func encodePricing(pricing *definitionSourcePricing) ([]byte, error) {
	pricing = normalizeDefinitionSourcePricing(pricing)
	if pricing == nil {
		return []byte("null"), nil
	}
	raw, err := json.Marshal(pricing)
	if err != nil {
		return nil, fmt.Errorf("platformk8s/models: encode pricing: %w", err)
	}
	return raw, nil
}

func decodePricing(raw []byte) (*definitionSourcePricing, error) {
	if len(raw) == 0 || string(raw) == "null" {
		return nil, nil
	}
	var pricing definitionSourcePricing
	if err := json.Unmarshal(raw, &pricing); err != nil {
		return nil, fmt.Errorf("platformk8s/models: decode pricing: %w", err)
	}
	return normalizeDefinitionSourcePricing(&pricing), nil
}
