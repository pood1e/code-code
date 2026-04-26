package models

import (
	"slices"
	"strings"

	modelv1 "code-code.internal/go-contract/model/v1"
	"github.com/OpenRouterTeam/go-sdk/models/components"
)

type openRouterDefinitionCandidate struct {
	sourceID          string
	canonicalSourceID string
	definition        *modelv1.ModelDefinition
	pricing           *definitionSourcePricing
	sources           []definitionSource
}

func normalizeOpenRouterDefinitions(
	items []components.Model,
	scope configuredVendorScope,
	knownCanonicalModelIDs map[string]map[string]struct{},
	aggregateVendorID string,
) map[string][]collectedDefinition {
	grouped := normalizeOpenRouterCanonicalDefinitions(items, scope, knownCanonicalModelIDs)
	if strings.TrimSpace(aggregateVendorID) == "" {
		return grouped
	}
	for vendorID, definitions := range normalizeOpenRouterAggregateDefinitions(items, scope, aggregateVendorID) {
		grouped[vendorID] = append(grouped[vendorID], definitions...)
	}
	return grouped
}

func normalizeOpenRouterCanonicalDefinitions(
	items []components.Model,
	scope configuredVendorScope,
	knownCanonicalModelIDs map[string]map[string]struct{},
) map[string][]collectedDefinition {
	byVendor := map[string]map[string]openRouterDefinitionCandidate{}
	for _, item := range items {
		vendorID, candidate, ok := normalizeOpenRouterModel(item, scope, knownCanonicalModelIDs)
		if !ok {
			continue
		}
		if byVendor[vendorID] == nil {
			byVendor[vendorID] = map[string]openRouterDefinitionCandidate{}
		}
		current, exists := byVendor[vendorID][candidate.definition.GetModelId()]
		if !exists {
			byVendor[vendorID][candidate.definition.GetModelId()] = candidate
			continue
		}
		byVendor[vendorID][candidate.definition.GetModelId()] = mergeOpenRouterDefinitions(current, candidate)
	}

	out := make(map[string][]collectedDefinition, len(byVendor))
	for vendorID, models := range byVendor {
		items := make([]collectedDefinition, 0, len(models))
		for _, candidate := range models {
			items = append(items, collectedDefinition{
				definition: candidate.definition,
				pricing:    cloneDefinitionSourcePricing(candidate.pricing),
				sources:    cloneDefinitionSources(candidate.sources),
			})
		}
		slices.SortFunc(items, func(left, right collectedDefinition) int {
			return strings.Compare(left.definition.GetModelId(), right.definition.GetModelId())
		})
		out[vendorID] = items
	}
	return out
}

func normalizeOpenRouterModel(
	item components.Model,
	scope configuredVendorScope,
	knownCanonicalModelIDs map[string]map[string]struct{},
) (string, openRouterDefinitionCandidate, bool) {
	sourceID := strings.TrimSpace(item.ID)
	canonicalSourceID := strings.TrimSpace(item.CanonicalSlug)
	if canonicalSourceID == "" {
		canonicalSourceID = sourceID
	}
	_, sourceModelID, ok := parseOpenRouterVendorModelID(sourceID)
	if !ok {
		return "", openRouterDefinitionCandidate{}, false
	}

	vendorID, identity, ok := normalizeOpenRouterIdentity(sourceID, canonicalSourceID, scope, knownCanonicalModelIDs)
	if !ok {
		return "", openRouterDefinitionCandidate{}, false
	}
	var maxOutputTokens int64
	if item.TopProvider.MaxCompletionTokens != nil {
		maxOutputTokens = *item.TopProvider.MaxCompletionTokens
	}
	definition := &modelv1.ModelDefinition{
		ModelId:             identity.modelID,
		DisplayName:         strings.TrimSpace(item.Name),
		VendorId:            vendorID,
		Aliases:             identity.aliases,
		ContextWindowTokens: item.ContextLength,
		MaxOutputTokens:     maxOutputTokens,
		Capabilities:        openRouterCapabilities(item.SupportedParameters, item.Architecture.InputModalities),
		InputModalities:     openRouterInputModalities(item.Architecture.InputModalities),
		OutputModalities:    openRouterOutputModalities(item.Architecture.OutputModalities),
	}
	source := newDefinitionSource(
		vendorID,
		sourceModelID,
		SourceIDOpenRouter,
		true,
		strings.TrimSpace(item.Name),
		nil,
		openRouterSourcePricing(item),
	)
	source.sourceModelID = sourceID
	return vendorID, openRouterDefinitionCandidate{
		sourceID:          sourceID,
		canonicalSourceID: canonicalSourceID,
		definition:        definition,
		pricing:           openRouterSourcePricing(item),
		sources:           []definitionSource{source},
	}, true
}

func normalizeOpenRouterVendorID(prefix string, scope configuredVendorScope) (string, bool) {
	return normalizeCollectedVendorID(prefix, scope)
}

func openRouterCapabilities(parameters []components.Parameter, inputModalities []components.InputModality) []modelv1.ModelCapability {
	set := map[modelv1.ModelCapability]struct{}{}
	for _, parameter := range parameters {
		switch strings.TrimSpace(string(parameter)) {
		case "tools", "tool_choice":
			set[modelv1.ModelCapability_MODEL_CAPABILITY_TOOL_CALLING] = struct{}{}
		case "structured_outputs", "response_format":
			set[modelv1.ModelCapability_MODEL_CAPABILITY_STRUCTURED_OUTPUT] = struct{}{}
		}
	}
	for _, modality := range inputModalities {
		if strings.TrimSpace(string(modality)) == "image" {
			set[modelv1.ModelCapability_MODEL_CAPABILITY_IMAGE_INPUT] = struct{}{}
		}
	}
	out := make([]modelv1.ModelCapability, 0, len(set))
	for capability := range set {
		out = append(out, capability)
	}
	slices.Sort(out)
	return out
}

func openRouterInputModalities(values []components.InputModality) []modelv1.Modality {
	set := map[modelv1.Modality]struct{}{}
	for _, value := range values {
		switch strings.TrimSpace(string(value)) {
		case "text":
			set[modelv1.Modality_MODALITY_TEXT] = struct{}{}
		case "image":
			set[modelv1.Modality_MODALITY_IMAGE] = struct{}{}
		case "audio":
			set[modelv1.Modality_MODALITY_AUDIO] = struct{}{}
		case "video":
			set[modelv1.Modality_MODALITY_VIDEO] = struct{}{}
		}
	}
	out := make([]modelv1.Modality, 0, len(set))
	for modality := range set {
		out = append(out, modality)
	}
	slices.Sort(out)
	return out
}

func openRouterOutputModalities(values []components.OutputModality) []modelv1.Modality {
	set := map[modelv1.Modality]struct{}{}
	for _, value := range values {
		switch strings.TrimSpace(string(value)) {
		case "text":
			set[modelv1.Modality_MODALITY_TEXT] = struct{}{}
		case "image":
			set[modelv1.Modality_MODALITY_IMAGE] = struct{}{}
		case "audio":
			set[modelv1.Modality_MODALITY_AUDIO] = struct{}{}
		case "video":
			set[modelv1.Modality_MODALITY_VIDEO] = struct{}{}
		}
	}
	out := make([]modelv1.Modality, 0, len(set))
	for modality := range set {
		out = append(out, modality)
	}
	slices.Sort(out)
	return out
}

func mergeOpenRouterDefinitions(current openRouterDefinitionCandidate, candidate openRouterDefinitionCandidate) openRouterDefinitionCandidate {
	preferred := current
	fallback := candidate
	if openRouterCandidatePriority(candidate) < openRouterCandidatePriority(current) ||
		(openRouterCandidatePriority(candidate) == openRouterCandidatePriority(current) && strings.Compare(candidate.sourceID, current.sourceID) < 0) {
		preferred = candidate
		fallback = current
	}
	definition := preferred.definition
	if definition == nil {
		return fallback
	}
	if fallback.definition == nil {
		return preferred
	}
	if strings.TrimSpace(definition.GetDisplayName()) == "" && strings.TrimSpace(fallback.definition.GetDisplayName()) != "" {
		definition.DisplayName = fallback.definition.GetDisplayName()
	}
	if definition.GetContextWindowTokens() == 0 && fallback.definition.GetContextWindowTokens() != 0 {
		definition.ContextWindowTokens = fallback.definition.GetContextWindowTokens()
	}
	if definition.GetMaxOutputTokens() == 0 && fallback.definition.GetMaxOutputTokens() != 0 {
		definition.MaxOutputTokens = fallback.definition.GetMaxOutputTokens()
	}
	definition.Aliases = mergeDefinitionAliases(definition.GetAliases(), fallback.definition.GetAliases())
	if len(definition.GetCapabilities()) == 0 && len(fallback.definition.GetCapabilities()) > 0 {
		definition.Capabilities = append([]modelv1.ModelCapability(nil), fallback.definition.GetCapabilities()...)
	}
	if len(definition.GetInputModalities()) == 0 && len(fallback.definition.GetInputModalities()) > 0 {
		definition.InputModalities = append([]modelv1.Modality(nil), fallback.definition.GetInputModalities()...)
	}
	if len(definition.GetOutputModalities()) == 0 && len(fallback.definition.GetOutputModalities()) > 0 {
		definition.OutputModalities = append([]modelv1.Modality(nil), fallback.definition.GetOutputModalities()...)
	}
	preferred.definition = definition
	preferred.pricing = mergeDefinitionSourcePricing(preferred.pricing, fallback.pricing)
	preferred.sources = mergeDefinitionSources(preferred.sources, fallback.sources)
	return preferred
}

func openRouterSourcePricing(item components.Model) *definitionSourcePricing {
	var cacheReadInput, cacheWriteInput string
	if item.Pricing.InputCacheRead != nil {
		cacheReadInput = *item.Pricing.InputCacheRead
	}
	if item.Pricing.InputCacheWrite != nil {
		cacheWriteInput = *item.Pricing.InputCacheWrite
	}
	return normalizeDefinitionSourcePricing(&definitionSourcePricing{
		Input:           item.Pricing.Prompt,
		Output:          item.Pricing.Completion,
		CacheReadInput:  cacheReadInput,
		CacheWriteInput: cacheWriteInput,
	})
}

func routeVariantFromSourceID(sourceID string) string {
	_, modelID, ok := parseOpenRouterVendorModelID(sourceID)
	if !ok {
		return ""
	}
	_, variant := splitOpenRouterRouteVariant(modelID)
	return variant
}

func openRouterCandidatePriority(candidate openRouterDefinitionCandidate) int {
	switch {
	case candidate.sourceID == candidate.canonicalSourceID:
		return 0
	case !strings.Contains(candidate.sourceID, ":"):
		return 1
	default:
		return 2
	}
}

func openRouterModalities(values []string) []modelv1.Modality {
	set := map[modelv1.Modality]struct{}{}
	for _, value := range values {
		switch strings.TrimSpace(value) {
		case "text":
			set[modelv1.Modality_MODALITY_TEXT] = struct{}{}
		case "image":
			set[modelv1.Modality_MODALITY_IMAGE] = struct{}{}
		case "audio":
			set[modelv1.Modality_MODALITY_AUDIO] = struct{}{}
		case "video":
			set[modelv1.Modality_MODALITY_VIDEO] = struct{}{}
		}
	}
	out := make([]modelv1.Modality, 0, len(set))
	for modality := range set {
		out = append(out, modality)
	}
	slices.Sort(out)
	return out
}
