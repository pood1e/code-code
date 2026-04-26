package models

import (
	"context"
	"net/http"
	"slices"
	"time"
)

func init() {
	registerDefinitionSourceCollector(definitionSourceCollectorSpec{
		sourceID:          SourceIDHuggingFaceHub,
		collectionOrder:   400,
		authorityPriority: 200,
		timeout:           12 * time.Second,
		collect:           collectHuggingFaceDefinitions,
	})
}

func collectHuggingFaceDefinitions(ctx context.Context, r *DefinitionSyncReconciler, httpClient *http.Client, snapshot *collectedDefinitionsSnapshot) {
	vendorIDs := make([]string, 0, len(snapshot.configuredVendorIDs))
	for vendorID := range snapshot.configuredVendorIDs {
		vendorIDs = append(vendorIDs, vendorID)
	}
	slices.Sort(vendorIDs)

	items := make([]huggingFaceModel, 0)
	for _, vendorID := range vendorIDs {
		for _, author := range huggingFaceAuthorCandidates(vendorID, snapshot.vendorScope) {
			if ctx.Err() != nil {
				return
			}
			page, err := fetchHuggingFaceModels(ctx, httpClient, r.definitionSourceEndpoint(SourceIDHuggingFaceHub), author)
			if err != nil {
				if definitionSourceEndpointUnavailable(err) {
					r.logger.Warn(
						"skip huggingface collection because endpoint is unavailable; stop remaining author probes",
						"vendor_id", vendorID,
						"author", author,
						"error", err,
					)
					return
				}
				r.logger.Warn("skip huggingface author collection", "vendor_id", vendorID, "author", author, "error", err)
				continue
			}
			items = append(items, page...)
		}
	}
	mergeCollectedDefinitionsSnapshot(snapshot, normalizeHuggingFaceDefinitions(items, snapshot.vendorScope, knownCanonicalModelIDs(snapshot)), r.logger)
}
