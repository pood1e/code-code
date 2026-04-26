package models

import (
	"context"
	"net/http"
	"strings"
	"time"
)

func init() {
	registerDefinitionSourceCollector(definitionSourceCollectorSpec{
		sourceID:          SourceIDOpenRouter,
		collectionOrder:   600,
		authorityPriority: 100,
		presetVendor:      true,
		timeout:           15 * time.Second,
		collect:           collectOpenRouterDefinitions,
	})
}

func collectOpenRouterDefinitions(ctx context.Context, r *DefinitionSyncReconciler, httpClient *http.Client, snapshot *collectedDefinitionsSnapshot) {
	items, err := fetchOpenRouterModels(ctx, httpClient, r.definitionSourceEndpoint(SourceIDOpenRouter))
	if err != nil {
		r.logger.Warn("skip openrouter model collection", "error", err)
		return
	}
	aggregateVendorID, _ := snapshot.vendorScope.configuredVendorID(SourceIDOpenRouter)
	if strings.TrimSpace(aggregateVendorID) != "" {
		snapshot.managedVendorIDs[aggregateVendorID] = struct{}{}
	}
	mergeCollectedDefinitionsSnapshot(snapshot, normalizeOpenRouterDefinitions(items, snapshot.vendorScope, knownCanonicalModelIDs(snapshot), aggregateVendorID), r.logger)
}
