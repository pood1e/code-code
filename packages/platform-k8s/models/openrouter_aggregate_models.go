package models

import (
	"slices"
	"strings"

	modelv1 "code-code.internal/go-contract/model/v1"
	"github.com/OpenRouterTeam/go-sdk/models/components"
)

func normalizeOpenRouterAggregateDefinitions(items []components.Model, scope configuredVendorScope, aggregateVendorID string) map[string][]collectedDefinition {
	models := map[string]collectedDefinition{}
	for _, item := range items {
		candidate, ok := normalizeOpenRouterAggregateModel(item, scope, aggregateVendorID)
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

	grouped := make([]collectedDefinition, 0, len(models))
	for _, candidate := range models {
		grouped = append(grouped, collectedDefinition{
			definition: candidate.definition,
			sourceRef:  cloneModelRef(candidate.sourceRef),
			badges:     normalizeDefinitionSourceBadges(candidate.badges),
			pricing:    cloneDefinitionSourcePricing(candidate.pricing),
			sources:    cloneDefinitionSources(candidate.sources),
		})
	}
	slices.SortFunc(grouped, func(left, right collectedDefinition) int {
		return strings.Compare(left.definition.GetModelId(), right.definition.GetModelId())
	})
	return map[string][]collectedDefinition{
		aggregateVendorID: grouped,
	}
}

func normalizeOpenRouterAggregateModel(item components.Model, scope configuredVendorScope, aggregateVendorID string) (collectedDefinition, bool) {
	sourceID := strings.TrimSpace(item.ID)
	sourceVendorID, routeModelID, ok := parseOpenRouterVendorModelID(sourceID)
	if !ok {
		return collectedDefinition{}, false
	}
	baseModelID, routeVariant := splitOpenRouterRouteVariant(routeModelID)
	if strings.TrimSpace(sourceVendorID) == "" || strings.TrimSpace(baseModelID) == "" || isOpenRouterChannelModel(baseModelID) {
		return collectedDefinition{}, false
	}
	canonicalVendorID, ok := normalizeOpenRouterVendorID(sourceVendorID, scope)
	if !ok {
		return collectedDefinition{}, false
	}

	source := newDefinitionSource(
		aggregateVendorID,
		canonicalVendorID+"/"+strings.TrimSpace(routeModelID),
		SourceIDOpenRouter,
		true,
		strings.TrimSpace(item.Name),
		openRouterSourceBadges(routeVariant),
		openRouterSourcePricing(item),
	)
	source.sourceModelID = sourceID
	var maxOutputTokens int64
	if item.TopProvider.MaxCompletionTokens != nil {
		maxOutputTokens = *item.TopProvider.MaxCompletionTokens
	}
	return collectedDefinition{
		definition: &modelv1.ModelDefinition{
			ModelId:             canonicalVendorID + "/" + strings.TrimSpace(routeModelID),
			DisplayName:         strings.TrimSpace(item.Name),
			VendorId:            aggregateVendorID,
			ContextWindowTokens: item.ContextLength,
			MaxOutputTokens:     maxOutputTokens,
			Capabilities:        openRouterCapabilities(item.SupportedParameters, item.Architecture.InputModalities),
			InputModalities:     openRouterInputModalities(item.Architecture.InputModalities),
			OutputModalities:    openRouterOutputModalities(item.Architecture.OutputModalities),
		},
		sourceRef: &modelv1.ModelRef{
			VendorId: canonicalVendorID,
			ModelId:  strings.TrimSpace(baseModelID),
		},
		badges:  openRouterSourceBadges(routeVariant),
		pricing: openRouterSourcePricing(item),
		sources: []definitionSource{source},
	}, true
}
