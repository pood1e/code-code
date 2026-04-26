package models

import (
	"context"
	"net/http"
	"strings"
	"time"
)

func init() {
	registerDefinitionSourceCollector(definitionSourceCollectorSpec{
		sourceID:          SourceIDCerebras,
		collectionOrder:   200,
		authorityPriority: 500,
		presetVendor:      true,
		timeout:           6 * time.Second,
		collect:           collectCerebrasDefinitions,
	})
}

func collectCerebrasDefinitions(ctx context.Context, r *DefinitionSyncReconciler, httpClient *http.Client, snapshot *collectedDefinitionsSnapshot) {
	items, err := fetchCerebrasModels(ctx, httpClient, r.definitionSourceEndpoint(SourceIDCerebras))
	if err != nil {
		r.logger.Warn("skip cerebras model collection", "error", err)
		return
	}
	aggregateVendorID, _ := snapshot.vendorScope.configuredVendorID(SourceIDCerebras)
	if strings.TrimSpace(aggregateVendorID) != "" {
		snapshot.managedVendorIDs[aggregateVendorID] = struct{}{}
	}
	mergeCollectedDefinitionsSnapshot(snapshot, normalizeCerebrasDefinitions(items, snapshot.vendorScope, knownCanonicalModelIDs(snapshot), aggregateVendorID), r.logger)
}
