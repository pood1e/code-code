package models

import (
	"slices"
	"strings"
)

func normalizeHuggingFaceDefinitions(
	items []huggingFaceModel,
	scope configuredVendorScope,
	knownCanonicalModelIDs map[string]map[string]struct{},
) map[string][]collectedDefinition {
	return normalizeExternalHostedDefinitions(SourceIDHuggingFaceHub, items, scope, knownCanonicalModelIDs, func(item huggingFaceModel) (string, string, string, bool, bool) {
		modelID := strings.TrimSpace(item.ModelID)
		if modelID == "" {
			modelID = strings.TrimSpace(item.ID)
		}
		owner, rawModelID, ok := strings.Cut(modelID, "/")
		if !ok {
			return "", "", "", false, false
		}
		if shouldSkipHuggingFaceModel(item, rawModelID) {
			return "", "", "", false, false
		}
		return owner, rawModelID, rawModelID, true, true
	})
}

func huggingFaceAuthorCandidates(vendorID string, scope configuredVendorScope) []string {
	candidates := []string{vendorID}
	candidates = append(candidates, scope.aliasCandidates(vendorID)...)
	candidates = append(candidates, titleCaseVendorID(vendorID))

	out := make([]string, 0, len(candidates))
	seen := map[string]struct{}{}
	for _, candidate := range candidates {
		candidate = strings.TrimSpace(candidate)
		if candidate == "" {
			continue
		}
		if _, ok := seen[candidate]; ok {
			continue
		}
		seen[candidate] = struct{}{}
		out = append(out, candidate)
	}
	slices.Sort(out)
	return out
}

func shouldSkipHuggingFaceModel(item huggingFaceModel, rawModelID string) bool {
	if strings.TrimSpace(strings.ToLower(item.PipelineTag)) != "text-generation" {
		return true
	}
	if hasChannelToken(rawModelID) || hasModelToken(rawModelID, "awq", "gguf", "gptq", "mlx", "onnx") {
		return true
	}
	for _, tag := range item.Tags {
		normalized := strings.TrimSpace(strings.ToLower(tag))
		switch normalized {
		case "awq", "gguf", "gptq", "mlx", "onnx":
			return true
		}
		if strings.HasPrefix(normalized, "base_model:quantized:") {
			return true
		}
	}
	return false
}

func titleCaseVendorID(vendorID string) string {
	parts := strings.FieldsFunc(strings.TrimSpace(vendorID), func(r rune) bool {
		return r == '-' || r == '_'
	})
	for index, part := range parts {
		if part == "" {
			continue
		}
		parts[index] = strings.ToUpper(part[:1]) + part[1:]
	}
	return strings.Join(parts, "-")
}
