package models

import (
	"slices"
	"strings"

	modelv1 "code-code.internal/go-contract/model/v1"
)

func normalizeCerebrasDefinitions(
	items []cerebrasModel,
	scope configuredVendorScope,
	knownCanonicalModelIDs map[string]map[string]struct{},
	aggregateVendorID string,
) map[string][]collectedDefinition {
	byVendor := map[string]map[string]collectedDefinition{}
	for _, item := range items {
		vendorID, candidate, ok := normalizeCerebrasCanonicalModel(item, scope, knownCanonicalModelIDs)
		if !ok {
			continue
		}
		if byVendor[vendorID] == nil {
			byVendor[vendorID] = map[string]collectedDefinition{}
		}
		current, ok := byVendor[vendorID][candidate.definition.GetModelId()]
		if !ok {
			byVendor[vendorID][candidate.definition.GetModelId()] = candidate
			continue
		}
		byVendor[vendorID][candidate.definition.GetModelId()] = mergeCollectedDefinitions(current, candidate)
	}
	out := sortCollectedDefinitionsByVendor(byVendor)
	if strings.TrimSpace(aggregateVendorID) == "" {
		return out
	}
	for vendorID, definitions := range normalizeCerebrasAggregateDefinitions(items, scope, knownCanonicalModelIDs, aggregateVendorID) {
		out[vendorID] = append(out[vendorID], definitions...)
	}
	return out
}

func normalizeCerebrasCanonicalModel(
	item cerebrasModel,
	scope configuredVendorScope,
	knownCanonicalModelIDs map[string]map[string]struct{},
) (string, collectedDefinition, bool) {
	vendorID, rawModelID, callableModelID, ok := normalizeCerebrasModelIdentity(item, scope, knownCanonicalModelIDs)
	if !ok {
		return "", collectedDefinition{}, false
	}
	modelID, aliases, ok := normalizeExternalModelIdentity(vendorID, rawModelID, knownCanonicalModelIDs[vendorID])
	if !ok {
		return "", collectedDefinition{}, false
	}
	source := newDefinitionSource(vendorID, rawModelID, SourceIDCerebras, true, strings.TrimSpace(item.Name), nil, cerebrasPricing(item))
	source.sourceModelID = callableModelID
	return vendorID, collectedDefinition{
		definition: &modelv1.ModelDefinition{
			ModelId:             modelID,
			DisplayName:         strings.TrimSpace(item.Name),
			VendorId:            vendorID,
			Aliases:             aliases,
			ContextWindowTokens: item.Limits.MaxContextLength,
			MaxOutputTokens:     item.Limits.MaxCompletionTokens,
			Capabilities:        cerebrasCapabilities(item),
			InputModalities:     cerebrasInputModalities(item),
			OutputModalities:    []modelv1.Modality{modelv1.Modality_MODALITY_TEXT},
		},
		pricing: cerebrasPricing(item),
		sources: []definitionSource{source},
	}, true
}

func normalizeCerebrasModelIdentity(
	item cerebrasModel,
	scope configuredVendorScope,
	knownCanonicalModelIDs map[string]map[string]struct{},
) (string, string, string, bool) {
	owner := strings.TrimSpace(item.OwnedBy)
	rawModelID := strings.TrimSpace(item.ID)
	callableModelID := rawModelID
	if hfOwner, hfModelID, ok := strings.Cut(strings.TrimSpace(item.HuggingFaceID), "/"); ok {
		owner = hfOwner
		rawModelID = hfModelID
	}
	vendorID, ok := normalizeCollectedVendorID(owner, scope)
	if !ok {
		return "", "", "", false
	}
	if _, _, ok := normalizeExternalModelIdentity(vendorID, rawModelID, knownCanonicalModelIDs[vendorID]); !ok {
		return "", "", "", false
	}
	return vendorID, rawModelID, callableModelID, true
}

func cerebrasPricing(item cerebrasModel) *definitionSourcePricing {
	return normalizeDefinitionSourcePricing(&definitionSourcePricing{
		Input:  item.Pricing.Prompt,
		Output: item.Pricing.Completion,
	})
}

func cerebrasCapabilities(item cerebrasModel) []modelv1.ModelCapability {
	out := make([]modelv1.ModelCapability, 0, 4)
	if item.Capabilities.FunctionCalling {
		out = append(out, modelv1.ModelCapability_MODEL_CAPABILITY_TOOL_CALLING)
	}
	if item.Capabilities.StructuredOutputs {
		out = append(out, modelv1.ModelCapability_MODEL_CAPABILITY_STRUCTURED_OUTPUT)
	}
	if item.Capabilities.Vision {
		out = append(out, modelv1.ModelCapability_MODEL_CAPABILITY_IMAGE_INPUT)
	}
	slices.Sort(out)
	return out
}

func cerebrasInputModalities(item cerebrasModel) []modelv1.Modality {
	if item.Capabilities.Vision {
		return []modelv1.Modality{
			modelv1.Modality_MODALITY_IMAGE,
			modelv1.Modality_MODALITY_TEXT,
		}
	}
	return []modelv1.Modality{modelv1.Modality_MODALITY_TEXT}
}
