package models

import (
	"slices"
	"strings"

	modelv1 "code-code.internal/go-contract/model/v1"
)

func githubModelsDefinition(
	vendorID string,
	rawModelID string,
	displayName string,
	item githubModelsCatalogModel,
	knownCanonicalModelIDs map[string]struct{},
) *modelv1.ModelDefinition {
	modelID, aliases, ok := normalizeExternalModelIdentity(vendorID, rawModelID, knownCanonicalModelIDs)
	if !ok {
		return nil
	}
	return &modelv1.ModelDefinition{
		VendorId:            vendorID,
		ModelId:             modelID,
		DisplayName:         displayName,
		Aliases:             aliases,
		ContextWindowTokens: item.Limits.MaxInputTokens,
		MaxOutputTokens:     item.Limits.MaxOutputTokens,
		PrimaryShape:        modelv1.ModelShape_MODEL_SHAPE_CHAT_COMPLETIONS,
		SupportedShapes:     []modelv1.ModelShape{modelv1.ModelShape_MODEL_SHAPE_CHAT_COMPLETIONS},
		Capabilities:        githubModelsCapabilities(item),
		InputModalities:     githubModelsModalities(item.SupportedInputModalities),
		OutputModalities:    githubModelsModalities(item.SupportedOutputModalities),
	}
}

func sortCollectedDefinitionsByVendor(byVendor map[string]map[string]collectedDefinition) map[string][]collectedDefinition {
	out := make(map[string][]collectedDefinition, len(byVendor))
	for vendorID, models := range byVendor {
		grouped := make([]collectedDefinition, 0, len(models))
		for _, candidate := range models {
			grouped = append(grouped, candidate)
		}
		slices.SortFunc(grouped, func(left, right collectedDefinition) int {
			return strings.Compare(left.definition.GetModelId(), right.definition.GetModelId())
		})
		out[vendorID] = grouped
	}
	return out
}

func githubModelsShouldSkip(item githubModelsCatalogModel) bool {
	if strings.Contains(strings.ToLower(strings.TrimSpace(item.ID)), "preview") || strings.Contains(strings.ToLower(strings.TrimSpace(item.Name)), "preview") {
		return true
	}
	for _, modality := range item.SupportedOutputModalities {
		if strings.TrimSpace(strings.ToLower(modality)) == "embeddings" {
			return true
		}
	}
	return len(githubModelsModalities(item.SupportedOutputModalities)) == 0
}

func githubModelsCapabilities(item githubModelsCatalogModel) []modelv1.ModelCapability {
	set := map[modelv1.ModelCapability]struct{}{}
	for _, capability := range item.Capabilities {
		switch strings.TrimSpace(strings.ToLower(capability)) {
		case "tool-calling":
			set[modelv1.ModelCapability_MODEL_CAPABILITY_TOOL_CALLING] = struct{}{}
		case "structured-output", "structured-outputs":
			set[modelv1.ModelCapability_MODEL_CAPABILITY_STRUCTURED_OUTPUT] = struct{}{}
		}
	}
	for _, modality := range item.SupportedInputModalities {
		if strings.TrimSpace(strings.ToLower(modality)) == "image" {
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

func githubModelsModalities(values []string) []modelv1.Modality {
	return openRouterModalities(values)
}
