package models

import (
	"strings"

	modelv1 "code-code.internal/go-contract/model/v1"
)

func normalizeModelScopeDefinitions(
	items []modelScopeModel,
	scope configuredVendorScope,
	knownCanonicalModelIDs map[string]map[string]struct{},
	aggregateVendorID string,
) map[string][]collectedDefinition {
	grouped := normalizeModelScopeCanonicalDefinitions(items, scope, knownCanonicalModelIDs)
	if strings.TrimSpace(aggregateVendorID) == "" {
		return grouped
	}
	for vendorID, definitions := range normalizeModelScopeAggregateDefinitions(items, scope, knownCanonicalModelIDs, aggregateVendorID) {
		grouped[vendorID] = append(grouped[vendorID], definitions...)
	}
	return grouped
}

func normalizeModelScopeCanonicalDefinitions(
	items []modelScopeModel,
	scope configuredVendorScope,
	knownCanonicalModelIDs map[string]map[string]struct{},
) map[string][]collectedDefinition {
	return normalizeExternalHostedDefinitions(SourceIDModelScope, items, scope, knownCanonicalModelIDs, func(item modelScopeModel) (string, string, string, bool, bool) {
		vendorID, rawModelID, _, ok := normalizeModelScopeVendorModel(item, scope)
		if !ok {
			return "", "", "", false, false
		}
		return vendorID, rawModelID, rawModelID, true, true
	})
}

func normalizeModelScopeAggregateDefinitions(
	items []modelScopeModel,
	scope configuredVendorScope,
	knownCanonicalModelIDs map[string]map[string]struct{},
	aggregateVendorID string,
) map[string][]collectedDefinition {
	models := map[string]collectedDefinition{}
	for _, item := range items {
		candidate, ok := normalizeModelScopeAggregateModel(item, scope, knownCanonicalModelIDs, aggregateVendorID)
		if !ok {
			continue
		}
		modelID := candidate.definition.GetModelId()
		if current, exists := models[modelID]; exists {
			models[modelID] = mergeCollectedDefinitions(current, candidate)
			continue
		}
		models[modelID] = candidate
	}
	if len(models) == 0 {
		return nil
	}
	return sortCollectedDefinitionsByVendor(map[string]map[string]collectedDefinition{
		aggregateVendorID: models,
	})
}

func normalizeModelScopeAggregateModel(
	item modelScopeModel,
	scope configuredVendorScope,
	knownCanonicalModelIDs map[string]map[string]struct{},
	aggregateVendorID string,
) (collectedDefinition, bool) {
	vendorID, rawModelID, callableModelID, ok := normalizeModelScopeVendorModel(item, scope)
	if !ok {
		return collectedDefinition{}, false
	}
	modelID, _, ok := normalizeExternalModelIdentity(vendorID, rawModelID, knownCanonicalModelIDs[vendorID])
	if !ok {
		return collectedDefinition{}, false
	}
	source := newDefinitionSource(aggregateVendorID, callableModelID, SourceIDModelScope, true, callableModelID, nil, nil)
	source.sourceModelID = callableModelID
	return collectedDefinition{
		definition: &modelv1.ModelDefinition{
			VendorId:    aggregateVendorID,
			ModelId:     callableModelID,
			DisplayName: callableModelID,
		},
		sourceRef: &modelv1.ModelRef{
			VendorId: vendorID,
			ModelId:  modelID,
		},
		sources: []definitionSource{source},
	}, true
}

func normalizeModelScopeVendorModel(item modelScopeModel, scope configuredVendorScope) (string, string, string, bool) {
	callableModelID := strings.TrimSpace(item.ID)
	owner, rawModelID, ok := strings.Cut(callableModelID, "/")
	if !ok {
		return "", "", "", false
	}
	vendorID, ok := normalizeModelScopeVendorID(strings.TrimSpace(owner), strings.TrimSpace(rawModelID), scope)
	if !ok {
		return "", "", "", false
	}
	return vendorID, strings.TrimSpace(rawModelID), callableModelID, true
}

func normalizeModelScopeVendorID(owner string, rawModelID string, scope configuredVendorScope) (string, bool) {
	if vendorID, ok := normalizeCollectedVendorID(owner, scope); ok {
		return vendorID, true
	}
	normalizedModelID := normalizeExternalModelSlug(rawModelID)
	switch {
	case strings.HasPrefix(normalizedModelID, "c4ai-command-r"), strings.HasPrefix(normalizedModelID, "command-r"):
		return normalizeCollectedVendorID("cohere", scope)
	case strings.HasPrefix(normalizedModelID, "llama-"):
		return normalizeCollectedVendorID("meta", scope)
	case strings.HasPrefix(normalizedModelID, "gui-owl-"):
		return normalizeCollectedVendorID("tongyi-lab", scope)
	case strings.HasPrefix(normalizedModelID, "qwen-image-"):
		return normalizeCollectedVendorID("qwen", scope)
	default:
		return "", false
	}
}
