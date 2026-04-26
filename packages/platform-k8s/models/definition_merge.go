package models

import (
	"slices"
	"strings"

	modelv1 "code-code.internal/go-contract/model/v1"
)

func mergeCollectedDefinitions(primary collectedDefinition, fallback collectedDefinition) collectedDefinition {
	if compareCollectedDefinitionAuthority(fallback, primary) < 0 {
		primary, fallback = fallback, primary
	}
	mergedSourceRef := cloneModelRef(primary.sourceRef)
	if mergedSourceRef == nil {
		mergedSourceRef = cloneModelRef(fallback.sourceRef)
	}
	return collectedDefinition{
		definition: mergeDefinitionMetadata(primary.definition, fallback.definition),
		sourceRef:  mergedSourceRef,
		badges:     mergeDefinitionSourceBadges(primary.badges, fallback.badges),
		pricing:    mergeDefinitionSourcePricing(primary.pricing, fallback.pricing),
		sources:    mergeDefinitionSources(primary.sources, fallback.sources),
	}
}

func mergeDefinitionMetadata(primary *modelv1.ModelDefinition, fallback *modelv1.ModelDefinition) *modelv1.ModelDefinition {
	if primary == nil {
		return fallback
	}
	if fallback == nil {
		return primary
	}
	if strings.TrimSpace(primary.GetDisplayName()) == "" && strings.TrimSpace(fallback.GetDisplayName()) != "" {
		primary.DisplayName = fallback.GetDisplayName()
	}
	if primary.GetContextWindowTokens() == 0 && fallback.GetContextWindowTokens() != 0 {
		primary.ContextWindowTokens = fallback.GetContextWindowTokens()
	}
	if primary.GetMaxOutputTokens() == 0 && fallback.GetMaxOutputTokens() != 0 {
		primary.MaxOutputTokens = fallback.GetMaxOutputTokens()
	}
	if primary.GetPrimaryShape() == modelv1.ModelShape_MODEL_SHAPE_UNSPECIFIED && fallback.GetPrimaryShape() != modelv1.ModelShape_MODEL_SHAPE_UNSPECIFIED {
		primary.PrimaryShape = fallback.GetPrimaryShape()
	}
	if len(primary.GetSupportedShapes()) == 0 && len(fallback.GetSupportedShapes()) > 0 {
		primary.SupportedShapes = append([]modelv1.ModelShape(nil), fallback.GetSupportedShapes()...)
	}
	if len(primary.GetCapabilities()) == 0 && len(fallback.GetCapabilities()) > 0 {
		primary.Capabilities = append([]modelv1.ModelCapability(nil), fallback.GetCapabilities()...)
	}
	if len(primary.GetInputModalities()) == 0 && len(fallback.GetInputModalities()) > 0 {
		primary.InputModalities = append([]modelv1.Modality(nil), fallback.GetInputModalities()...)
	}
	if len(primary.GetOutputModalities()) == 0 && len(fallback.GetOutputModalities()) > 0 {
		primary.OutputModalities = append([]modelv1.Modality(nil), fallback.GetOutputModalities()...)
	}
	primary.Aliases = mergeDefinitionAliases(primary.GetAliases(), fallback.GetAliases())
	return primary
}

func mergeDefinitionAliases(left []*modelv1.ModelAlias, right []*modelv1.ModelAlias) []*modelv1.ModelAlias {
	if len(left) == 0 && len(right) == 0 {
		return nil
	}
	out := make([]*modelv1.ModelAlias, 0, len(left)+len(right))
	seen := map[string]struct{}{}
	appendAlias := func(alias *modelv1.ModelAlias) {
		if alias == nil {
			return
		}
		value := strings.TrimSpace(alias.GetValue())
		if value == "" {
			return
		}
		key := alias.GetKind().String() + "\x00" + value
		if _, ok := seen[key]; ok {
			return
		}
		seen[key] = struct{}{}
		out = append(out, &modelv1.ModelAlias{
			Kind:  alias.GetKind(),
			Value: value,
		})
	}
	for _, alias := range left {
		appendAlias(alias)
	}
	for _, alias := range right {
		appendAlias(alias)
	}
	slices.SortFunc(out, func(left *modelv1.ModelAlias, right *modelv1.ModelAlias) int {
		if left.GetKind() != right.GetKind() {
			return int(left.GetKind()) - int(right.GetKind())
		}
		return strings.Compare(left.GetValue(), right.GetValue())
	})
	return out
}
