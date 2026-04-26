package models

import (
	"context"
	"net/http"
	"strings"
	"time"
)

func init() {
	registerDefinitionSourceCollector(definitionSourceCollectorSpec{
		sourceID:          SourceIDGitHubModels,
		collectionOrder:   100,
		authorityPriority: 600,
		presetVendor:      true,
		timeout:           10 * time.Second,
		collect:           collectGitHubModelsDefinitions,
	})
}

func collectGitHubModelsDefinitions(ctx context.Context, r *DefinitionSyncReconciler, httpClient *http.Client, snapshot *collectedDefinitionsSnapshot) {
	items, err := fetchGitHubModels(ctx, httpClient, r.definitionSourceEndpoint(SourceIDGitHubModels))
	if err != nil {
		r.logger.Warn("skip github models collection", "error", err)
		return
	}
	aggregateVendorID, _ := snapshot.vendorScope.configuredVendorID(SourceIDGitHubModels)
	if strings.TrimSpace(aggregateVendorID) != "" {
		snapshot.managedVendorIDs[aggregateVendorID] = struct{}{}
	}
	mergeCollectedDefinitionsSnapshot(snapshot, normalizeGitHubModelsDefinitions(items, snapshot.vendorScope, knownCanonicalModelIDs(snapshot), aggregateVendorID), r.logger)
}
