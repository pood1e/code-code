package models

import (
	"context"
	"net/http"
	"strings"
	"time"
)

func init() {
	registerDefinitionSourceCollector(definitionSourceCollectorSpec{
		sourceID:          SourceIDModelScope,
		collectionOrder:   500,
		authorityPriority: 400,
		presetVendor:      true,
		timeout:           6 * time.Second,
		collect:           collectModelScopeDefinitions,
	})
}

func collectModelScopeDefinitions(ctx context.Context, r *DefinitionSyncReconciler, httpClient *http.Client, snapshot *collectedDefinitionsSnapshot) {
	items, err := fetchModelScopeModels(ctx, httpClient, r.definitionSourceEndpoint(SourceIDModelScope))
	if err != nil {
		r.logger.Warn("skip modelscope model collection", "error", err)
		return
	}
	aggregateVendorID, _ := snapshot.vendorScope.configuredVendorID(SourceIDModelScope)
	if strings.TrimSpace(aggregateVendorID) != "" {
		snapshot.managedVendorIDs[aggregateVendorID] = struct{}{}
	}
	mergeCollectedDefinitionsSnapshot(snapshot, normalizeModelScopeDefinitions(items, snapshot.vendorScope, knownCanonicalModelIDs(snapshot), aggregateVendorID), r.logger)
}
