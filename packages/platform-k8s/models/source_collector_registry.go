package models

import (
	"context"
	"fmt"
	"net/http"
	"slices"
	"strings"
	"time"
)

type definitionSourceCollectorSpec struct {
	sourceID          string
	collectionOrder   int
	authorityPriority int
	presetVendor      bool
	timeout           time.Duration
	collect           func(context.Context, *DefinitionSyncReconciler, *http.Client, *collectedDefinitionsSnapshot)
}

var definitionSourceCollectors = map[string]definitionSourceCollectorSpec{}
var orderedDefinitionSourceCollectors []definitionSourceCollectorSpec

func registerDefinitionSourceCollector(spec definitionSourceCollectorSpec) {
	sourceID := normalizeDefinitionSourceAliasID(spec.sourceID)
	if sourceID == "" {
		panic("platformk8s/models: source collector source id is empty")
	}
	if _, exists := definitionSourceCollectors[sourceID]; exists {
		panic(fmt.Sprintf("platformk8s/models: duplicate source collector %q", sourceID))
	}
	spec.sourceID = sourceID
	definitionSourceCollectors[sourceID] = spec
	orderedDefinitionSourceCollectors = nil
}

func registeredDefinitionSourceCollectors() []definitionSourceCollectorSpec {
	if orderedDefinitionSourceCollectors == nil {
		orderedDefinitionSourceCollectors = make([]definitionSourceCollectorSpec, 0, len(definitionSourceCollectors))
		for _, spec := range definitionSourceCollectors {
			orderedDefinitionSourceCollectors = append(orderedDefinitionSourceCollectors, spec)
		}
		slices.SortFunc(orderedDefinitionSourceCollectors, func(left, right definitionSourceCollectorSpec) int {
			if left.collectionOrder == right.collectionOrder {
				return strings.Compare(left.sourceID, right.sourceID)
			}
			if left.collectionOrder < right.collectionOrder {
				return -1
			}
			return 1
		})
	}
	return orderedDefinitionSourceCollectors
}

func lookupDefinitionSourceCollector(sourceID string) (definitionSourceCollectorSpec, bool) {
	spec, ok := definitionSourceCollectors[normalizeDefinitionSourceAliasID(sourceID)]
	return spec, ok
}

func normalizeDefinitionSourceEndpoints(values map[string]string) map[string]string {
	if len(values) == 0 {
		return nil
	}
	out := map[string]string{}
	for sourceID, endpoint := range values {
		spec, ok := lookupDefinitionSourceCollector(sourceID)
		if !ok {
			continue
		}
		endpoint = strings.TrimSpace(endpoint)
		if endpoint == "" {
			continue
		}
		out[spec.sourceID] = endpoint
	}
	if len(out) == 0 {
		return nil
	}
	return out
}

func (r *DefinitionSyncReconciler) definitionSourceEndpoint(sourceID string) string {
	if r == nil || len(r.sourceEndpoints) == 0 {
		return ""
	}
	return strings.TrimSpace(r.sourceEndpoints[normalizeDefinitionSourceAliasID(sourceID)])
}
