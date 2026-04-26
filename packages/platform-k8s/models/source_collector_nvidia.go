package models

import (
	"context"
	"net/http"
	"time"
)

func init() {
	registerDefinitionSourceCollector(definitionSourceCollectorSpec{
		sourceID:          SourceIDNVIDIAIntegrate,
		collectionOrder:   300,
		authorityPriority: 300,
		timeout:           6 * time.Second,
		collect:           collectNVIDIADefinitions,
	})
}

func collectNVIDIADefinitions(ctx context.Context, r *DefinitionSyncReconciler, httpClient *http.Client, snapshot *collectedDefinitionsSnapshot) {
	items, err := fetchNVIDIAModels(ctx, httpClient, r.definitionSourceEndpoint(SourceIDNVIDIAIntegrate))
	if err != nil {
		r.logger.Warn("skip nvidia integrate model collection", "error", err)
		return
	}
	mergeCollectedDefinitionsSnapshot(snapshot, normalizeNVIDIADefinitions(items, snapshot.vendorScope, knownCanonicalModelIDs(snapshot)), r.logger)
}
