package models

import (
	"context"
	"fmt"

	modelservicev1 "code-code.internal/go-contract/platform/model/v1"
	"code-code.internal/platform-k8s/domainevents"
	"github.com/jackc/pgx/v5/pgxpool"
)

type definitionSyncStore interface {
	ListManagedDefinitions(context.Context) ([]storedDefinition, error)
	UpsertManagedDefinition(context.Context, *modelservicev1.ModelRegistryEntry) error
	DeleteManagedDefinition(context.Context, surfaceIdentity) error
}

func newDefinitionSyncStore(config DefinitionSyncReconcilerConfig) (definitionSyncStore, error) {
	if config.StatePool == nil {
		return nil, fmt.Errorf("platformk8s/models: model registry requires postgres state pool")
	}
	return NewPostgresRegistryStore(config.StatePool, config.Outbox, config.Namespace)
}

type PostgresRegistryStore struct {
	pool      *pgxpool.Pool
	outbox    *domainevents.Outbox
	namespace string
}

func NewPostgresRegistryStore(pool *pgxpool.Pool, outbox *domainevents.Outbox, namespace string) (*PostgresRegistryStore, error) {
	return newPostgresRegistryStore(pool, outbox, namespace)
}
