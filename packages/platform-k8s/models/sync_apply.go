package models

import (
	"context"
	"fmt"
	"slices"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
)

func (r *DefinitionSyncReconciler) sync(ctx context.Context, snapshot *collectedDefinitionsSnapshot) error {
	if snapshot == nil {
		return nil
	}

	definitions, err := r.store.ListManagedDefinitions(ctx)
	if err != nil {
		return err
	}
	existingByIdentity := make(map[string]storedDefinition, len(definitions))
	for _, definition := range definitions {
		if definition.Definition == nil {
			continue
		}
		identity, err := identityFromDefinition(definition.Definition)
		if err != nil {
			return err
		}
		if _, ok := existingByIdentity[identity.key()]; ok {
			return fmt.Errorf("platformk8s/models: duplicate model definition identity %q/%q", identity.vendorID, identity.modelID)
		}
		existingByIdentity[identity.key()] = definition
	}

	keys := make([]string, 0, len(snapshot.definitions))
	for key := range snapshot.definitions {
		keys = append(keys, key)
	}
	slices.Sort(keys)
	for _, key := range keys {
		candidate := snapshot.definitions[key]
		if candidate.definition == nil {
			return fmt.Errorf("platformk8s/models: collected model definition %q is nil", key)
		}
		identity, err := identityFromDefinition(candidate.definition)
		if err != nil {
			return err
		}
		if err := r.store.UpsertManagedDefinition(
			ctx,
			newModelRegistryEntry(candidate.definition, candidate.sourceRef, candidate.sources, candidate.badges, candidate.pricing),
		); err != nil {
			return fmt.Errorf("platformk8s/models: upsert vendor-support model definition %q/%q: %w", identity.vendorID, identity.modelID, err)
		}
	}

	for _, existing := range definitions {
		identity, err := identityFromDefinition(existing.Definition)
		if err != nil {
			return err
		}
		if _, ok := snapshot.definitions[identity.key()]; ok {
			continue
		}
		if shouldKeepManagedDefinition(identity.vendorID, snapshot) {
			continue
		}
		if err := r.store.DeleteManagedDefinition(ctx, identity); err != nil && !apierrors.IsNotFound(err) {
			return fmt.Errorf("platformk8s/models: delete stale vendor-support model definition %q/%q: %w", identity.vendorID, identity.modelID, err)
		}
	}
	return nil
}

func shouldKeepManagedDefinition(vendorID string, snapshot *collectedDefinitionsSnapshot) bool {
	if snapshot == nil {
		return true
	}
	if _, configured := snapshot.managedVendorIDs[vendorID]; !configured {
		return false
	}
	if _, collected := snapshot.collectedVendorIDs[vendorID]; collected {
		return false
	}
	return true
}
