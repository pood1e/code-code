package models

import (
	"strings"

	modelv1 "code-code.internal/go-contract/model/v1"
)

func normalizeGitHubModelsDefinitions(
	items []githubModelsCatalogModel,
	scope configuredVendorScope,
	knownCanonicalModelIDs map[string]map[string]struct{},
	aggregateVendorID string,
) map[string][]collectedDefinition {
	grouped := normalizeGitHubCanonicalDefinitions(items, scope, knownCanonicalModelIDs)
	if strings.TrimSpace(aggregateVendorID) == "" {
		return grouped
	}
	for vendorID, definitions := range normalizeGitHubAggregateDefinitions(items, scope, knownCanonicalModelIDs, aggregateVendorID) {
		grouped[vendorID] = append(grouped[vendorID], definitions...)
	}
	return grouped
}

func normalizeGitHubCanonicalDefinitions(
	items []githubModelsCatalogModel,
	scope configuredVendorScope,
	knownCanonicalModelIDs map[string]map[string]struct{},
) map[string][]collectedDefinition {
	byVendor := map[string]map[string]collectedDefinition{}
	for _, item := range items {
		vendorID, modelID, candidate, ok := normalizeGitHubCanonicalModel(item, scope, knownCanonicalModelIDs)
		if !ok {
			continue
		}
		if byVendor[vendorID] == nil {
			byVendor[vendorID] = map[string]collectedDefinition{}
		}
		current, exists := byVendor[vendorID][modelID]
		if !exists {
			byVendor[vendorID][modelID] = candidate
			continue
		}
		byVendor[vendorID][modelID] = mergeCollectedDefinitions(current, candidate)
	}
	return sortCollectedDefinitionsByVendor(byVendor)
}

func normalizeGitHubAggregateDefinitions(
	items []githubModelsCatalogModel,
	scope configuredVendorScope,
	knownCanonicalModelIDs map[string]map[string]struct{},
	aggregateVendorID string,
) map[string][]collectedDefinition {
	models := map[string]collectedDefinition{}
	for _, item := range items {
		candidate, ok := normalizeGitHubAggregateModel(item, scope, knownCanonicalModelIDs, aggregateVendorID)
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

func normalizeGitHubCanonicalModel(
	item githubModelsCatalogModel,
	scope configuredVendorScope,
	knownCanonicalModelIDs map[string]map[string]struct{},
) (string, string, collectedDefinition, bool) {
	owner, rawModelID, _, callableModelID, ok := normalizeGitHubModelIdentity(item, scope, knownCanonicalModelIDs)
	if !ok {
		return "", "", collectedDefinition{}, false
	}
	source := newDefinitionSource(owner, rawModelID, SourceIDGitHubModels, true, strings.TrimSpace(item.Name), nil, nil)
	source.sourceModelID = callableModelID
	definition := githubModelsDefinition(owner, rawModelID, strings.TrimSpace(item.Name), item, knownCanonicalModelIDs[owner])
	return owner, definition.GetModelId(), collectedDefinition{
		definition: definition,
		sources:    []definitionSource{source},
	}, true
}

func normalizeGitHubAggregateModel(
	item githubModelsCatalogModel,
	scope configuredVendorScope,
	knownCanonicalModelIDs map[string]map[string]struct{},
	aggregateVendorID string,
) (collectedDefinition, bool) {
	vendorID, _, modelID, callableModelID, ok := normalizeGitHubModelIdentity(item, scope, knownCanonicalModelIDs)
	if !ok {
		return collectedDefinition{}, false
	}
	source := newDefinitionSource(aggregateVendorID, callableModelID, SourceIDGitHubModels, true, strings.TrimSpace(item.Name), nil, nil)
	source.sourceModelID = callableModelID
	return collectedDefinition{
		definition: &modelv1.ModelDefinition{
			VendorId:            aggregateVendorID,
			ModelId:             callableModelID,
			DisplayName:         strings.TrimSpace(item.Name),
			ContextWindowTokens: item.Limits.MaxInputTokens,
			MaxOutputTokens:     item.Limits.MaxOutputTokens,
			PrimaryShape:        modelv1.ModelShape_MODEL_SHAPE_CHAT_COMPLETIONS,
			SupportedShapes:     []modelv1.ModelShape{modelv1.ModelShape_MODEL_SHAPE_CHAT_COMPLETIONS},
			Capabilities:        githubModelsCapabilities(item),
			InputModalities:     githubModelsModalities(item.SupportedInputModalities),
			OutputModalities:    githubModelsModalities(item.SupportedOutputModalities),
		},
		sourceRef: &modelv1.ModelRef{VendorId: vendorID, ModelId: modelID},
		sources:   []definitionSource{source},
	}, true
}

func normalizeGitHubModelIdentity(
	item githubModelsCatalogModel,
	scope configuredVendorScope,
	knownCanonicalModelIDs map[string]map[string]struct{},
) (string, string, string, string, bool) {
	callableModelID := strings.TrimSpace(item.ID)
	if githubModelsShouldSkip(item) || callableModelID == "" {
		return "", "", "", "", false
	}
	owner, rawModelID, ok := strings.Cut(callableModelID, "/")
	if !ok {
		return "", "", "", "", false
	}
	vendorID, ok := normalizeCollectedVendorID(owner, scope)
	if !ok {
		return "", "", "", "", false
	}
	modelID, _, ok := normalizeExternalModelIdentity(vendorID, rawModelID, knownCanonicalModelIDs[vendorID])
	if !ok {
		return "", "", "", "", false
	}
	return vendorID, rawModelID, modelID, callableModelID, true
}
