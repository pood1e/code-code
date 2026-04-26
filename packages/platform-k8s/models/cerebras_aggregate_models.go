package models

import (
	"strings"

	modelv1 "code-code.internal/go-contract/model/v1"
)

func normalizeCerebrasAggregateDefinitions(
	items []cerebrasModel,
	scope configuredVendorScope,
	knownCanonicalModelIDs map[string]map[string]struct{},
	aggregateVendorID string,
) map[string][]collectedDefinition {
	models := map[string]collectedDefinition{}
	for _, item := range items {
		candidate, ok := normalizeCerebrasAggregateModel(item, scope, knownCanonicalModelIDs, aggregateVendorID)
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

func normalizeCerebrasAggregateModel(
	item cerebrasModel,
	scope configuredVendorScope,
	knownCanonicalModelIDs map[string]map[string]struct{},
	aggregateVendorID string,
) (collectedDefinition, bool) {
	vendorID, rawModelID, callableModelID, ok := normalizeCerebrasModelIdentity(item, scope, knownCanonicalModelIDs)
	if !ok {
		return collectedDefinition{}, false
	}
	modelID, _, ok := normalizeExternalModelIdentity(vendorID, rawModelID, knownCanonicalModelIDs[vendorID])
	if !ok {
		return collectedDefinition{}, false
	}
	source := newDefinitionSource(aggregateVendorID, callableModelID, SourceIDCerebras, true, strings.TrimSpace(item.Name), nil, cerebrasPricing(item))
	source.sourceModelID = callableModelID
	return collectedDefinition{
		definition: &modelv1.ModelDefinition{
			VendorId:            aggregateVendorID,
			ModelId:             callableModelID,
			DisplayName:         strings.TrimSpace(item.Name),
			ContextWindowTokens: item.Limits.MaxContextLength,
			MaxOutputTokens:     item.Limits.MaxCompletionTokens,
			Capabilities:        cerebrasCapabilities(item),
			InputModalities:     cerebrasInputModalities(item),
			OutputModalities:    []modelv1.Modality{modelv1.Modality_MODALITY_TEXT},
		},
		sourceRef: &modelv1.ModelRef{
			VendorId: vendorID,
			ModelId:  modelID,
		},
		pricing: cerebrasPricing(item),
		sources: []definitionSource{source},
	}, true
}
