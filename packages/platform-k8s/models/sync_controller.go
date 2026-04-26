package models

import (
	"context"
	"fmt"
	"log/slog"
	"strings"

	"code-code.internal/platform-k8s/domainevents"
	"github.com/jackc/pgx/v5/pgxpool"
	ctrlclient "sigs.k8s.io/controller-runtime/pkg/client"
)

// DefinitionSyncReconciler canonicalizes collected vendor model metadata into
// the model-service registry read model.
type DefinitionSyncReconciler struct {
	client          ctrlclient.Client
	namespace       string
	store           definitionSyncStore
	logger          *slog.Logger
	sourceEndpoints map[string]string
}

// DefinitionSyncReconcilerConfig groups dependencies for DefinitionSyncReconciler.
type DefinitionSyncReconcilerConfig struct {
	Client          ctrlclient.Client
	StatePool       *pgxpool.Pool
	Outbox          *domainevents.Outbox
	Namespace       string
	Logger          *slog.Logger
	SourceEndpoints map[string]string
}

// NewDefinitionSyncReconciler creates one model sync reconciler.
func NewDefinitionSyncReconciler(config DefinitionSyncReconcilerConfig) (*DefinitionSyncReconciler, error) {
	if config.Client == nil {
		return nil, fmt.Errorf("platformk8s/models: sync client is nil")
	}
	if strings.TrimSpace(config.Namespace) == "" {
		return nil, fmt.Errorf("platformk8s/models: sync namespace is empty")
	}
	store, err := newDefinitionSyncStore(config)
	if err != nil {
		return nil, err
	}
	if config.Logger == nil {
		config.Logger = slog.Default()
	}
	return &DefinitionSyncReconciler{
		client:          config.Client,
		namespace:       strings.TrimSpace(config.Namespace),
		store:           store,
		logger:          config.Logger,
		sourceEndpoints: normalizeDefinitionSourceEndpoints(config.SourceEndpoints),
	}, nil
}

// SyncNow refreshes authoritative collections immediately and applies them to
// managed model registry entries.
func (r *DefinitionSyncReconciler) SyncNow(ctx context.Context) error {
	snapshot, err := r.collectAuthoritativeDefinitions(ctx)
	if err != nil {
		return err
	}
	return r.sync(ctx, snapshot)
}
