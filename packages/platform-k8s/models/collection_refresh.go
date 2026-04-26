package models

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"slices"
	"strings"
	"time"

	"code-code.internal/platform-k8s/outboundhttp"
	vendorsupport "code-code.internal/platform-k8s/vendors/support"
)

const defaultDefinitionSourceCollectorTimeout = 10 * time.Second

type configuredVendor struct {
	name     string
	vendorID string
	aliases  []string
}

func (r *DefinitionSyncReconciler) collectAuthoritativeDefinitions(ctx context.Context) (*collectedDefinitionsSnapshot, error) {
	vendors, err := r.listConfiguredVendors(ctx)
	if err != nil {
		return nil, err
	}

	scope := newConfiguredVendorScope(vendors)
	if len(scope.managedIDs) == 0 {
		return newCollectedDefinitionsSnapshot(scope), nil
	}

	httpClient, err := r.newCollectionHTTPClient(ctx)
	if err != nil {
		return nil, err
	}
	snapshot := newCollectedDefinitionsSnapshot(scope)
	for _, collector := range registeredDefinitionSourceCollectors() {
		if collector.collect == nil {
			continue
		}
		if err := r.collectDefinitionSource(ctx, collector, httpClient, snapshot); err != nil {
			return nil, err
		}
	}
	enforceCollectedDefinitionRelationships(snapshot, r.logger)
	if len(snapshot.definitions) == 0 {
		r.logger.Warn(
			"model definition collection returned empty snapshot; preserve existing managed definitions until upstream sources recover",
			"configured_vendor_count", len(snapshot.managedVendorIDs),
		)
	}
	return snapshot, nil
}

func (r *DefinitionSyncReconciler) collectDefinitionSource(
	ctx context.Context,
	collector definitionSourceCollectorSpec,
	httpClient *http.Client,
	snapshot *collectedDefinitionsSnapshot,
) error {
	timeout := collector.timeout
	if timeout <= 0 {
		timeout = defaultDefinitionSourceCollectorTimeout
	}
	sourceCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	sourceHTTPClient := *httpClient
	if sourceHTTPClient.Timeout == 0 || sourceHTTPClient.Timeout > timeout {
		sourceHTTPClient.Timeout = timeout
	}
	collector.collect(sourceCtx, r, &sourceHTTPClient, snapshot)
	if err := ctx.Err(); err != nil {
		return err
	}
	return nil
}

func newCollectedDefinitionsSnapshot(scope configuredVendorScope) *collectedDefinitionsSnapshot {
	return &collectedDefinitionsSnapshot{
		vendorScope:         cloneConfiguredVendorScope(scope),
		configuredVendorIDs: cloneStringSet(scope.canonicalIDs),
		managedVendorIDs:    cloneStringSet(scope.managedIDs),
		collectedVendorIDs:  map[string]struct{}{},
		definitions:         map[string]collectedDefinition{},
	}
}

func mergeCollectedDefinitionsSnapshot(snapshot *collectedDefinitionsSnapshot, grouped map[string][]collectedDefinition, logger *slog.Logger) *collectedDefinitionsSnapshot {
	if logger == nil {
		logger = slog.Default()
	}
	if snapshot == nil {
		snapshot = newCollectedDefinitionsSnapshot(configuredVendorScope{})
	}

	vendorIDs := make([]string, 0, len(grouped))
	for vendorID := range grouped {
		vendorIDs = append(vendorIDs, vendorID)
	}
	slices.Sort(vendorIDs)

	for _, vendorID := range vendorIDs {
		items := grouped[vendorID]
		if len(items) == 0 {
			continue
		}
		snapshot.collectedVendorIDs[vendorID] = struct{}{}
		for index, item := range items {
			candidate, err := vendorSupportDefinitionCandidate(vendorID, item.definition)
			if err != nil {
				logger.Warn("skip invalid collected model definition",
					"vendor_id", vendorID,
					"source_index", index,
					"error", err,
				)
				continue
			}
			identity, err := identityFromDefinition(candidate)
			if err != nil {
				logger.Warn("skip collected model definition with invalid identity",
					"vendor_id", vendorID,
					"model_id", candidate.GetModelId(),
					"error", err,
				)
				continue
			}
			collected := collectedDefinition{
				definition: candidate,
				sourceRef:  cloneModelRef(item.sourceRef),
				badges:     normalizeDefinitionSourceBadges(item.badges),
				pricing:    cloneDefinitionSourcePricing(item.pricing),
				sources:    cloneDefinitionSources(item.sources),
			}
			if current, ok := snapshot.definitions[identity.key()]; ok {
				collected = mergeCollectedDefinitions(current, collected)
			}
			snapshot.definitions[identity.key()] = collected
		}
	}

	return snapshot
}

func knownCanonicalModelIDs(snapshot *collectedDefinitionsSnapshot) map[string]map[string]struct{} {
	out := map[string]map[string]struct{}{}
	if snapshot == nil {
		return out
	}
	for _, item := range snapshot.definitions {
		if item.definition == nil {
			continue
		}
		vendorID := strings.TrimSpace(item.definition.GetVendorId())
		modelID := strings.TrimSpace(item.definition.GetModelId())
		if vendorID == "" || modelID == "" {
			continue
		}
		if out[vendorID] == nil {
			out[vendorID] = map[string]struct{}{}
		}
		out[vendorID][modelID] = struct{}{}
	}
	return out
}

func enforceCollectedDefinitionRelationships(snapshot *collectedDefinitionsSnapshot, logger *slog.Logger) {
	if snapshot == nil {
		return
	}
	if logger == nil {
		logger = slog.Default()
	}
	resolver := newDirectDefinitionSourceRefResolver(snapshot)
	for key, item := range snapshot.definitions {
		if item.sourceRef == nil {
			continue
		}
		resolved, ok := resolver.resolve(item.sourceRef)
		if !ok {
			logger.Warn("drop proxy model without direct upstream model",
				"vendor_id", item.definition.GetVendorId(),
				"model_id", item.definition.GetModelId(),
				"source_vendor_id", item.sourceRef.GetVendorId(),
				"source_model_id", item.sourceRef.GetModelId(),
			)
			delete(snapshot.definitions, key)
			continue
		}
		item.sourceRef = resolved
		snapshot.definitions[key] = item
	}
}

func (r *DefinitionSyncReconciler) listConfiguredVendors(ctx context.Context) ([]configuredVendor, error) {
	registry, err := vendorsupport.NewManagementService()
	if err != nil {
		return nil, err
	}
	registered, err := registry.List(ctx)
	if err != nil {
		return nil, fmt.Errorf("platformk8s/models: list registered vendors for collection refresh: %w", err)
	}

	vendors := make([]configuredVendor, 0, len(registered))
	for _, vendor := range registered {
		if vendor == nil || vendor.GetVendor() == nil {
			continue
		}
		vendorID := strings.TrimSpace(vendor.GetVendor().GetVendorId())
		if vendorID == "" {
			r.logger.Warn("skip registered vendor support without vendor id")
			continue
		}
		vendors = append(vendors, configuredVendor{
			name:     vendorID,
			vendorID: vendorID,
			aliases:  append([]string(nil), vendor.GetVendor().GetAliases()...),
		})
	}
	slices.SortFunc(vendors, func(left, right configuredVendor) int {
		if left.vendorID == right.vendorID {
			return strings.Compare(left.name, right.name)
		}
		return strings.Compare(left.vendorID, right.vendorID)
	})
	return vendors, nil
}

func (r *DefinitionSyncReconciler) newCollectionHTTPClient(ctx context.Context) (*http.Client, error) {
	return outboundhttp.NewClientFactory().NewClient(ctx)
}
