package models

import (
	"slices"
	"strings"

	modelv1 "code-code.internal/go-contract/model/v1"
	"google.golang.org/protobuf/proto"
)

const (
	SourceIDOpenRouter      = "openrouter"
	SourceIDModelScope      = "modelscope"
	SourceIDCerebras        = "cerebras"
	SourceIDGitHubModels    = "github-models"
	SourceIDNVIDIAIntegrate = "nvidia-integrate"
	SourceIDHuggingFaceHub  = "huggingface-hub"

	definitionSourceKindPreset = "preset"
)

type definitionSource struct {
	vendorID          string
	modelID           string
	sourceID          string
	aliasID           string
	kind              string
	isDirect          bool
	sourceModelID     string
	displayName       string
	definition        *modelv1.ModelDefinition
	badges            []string
	pricing           *definitionSourcePricing
	authorityPriority int32
}

func normalizeDefinitionSources(sources []definitionSource) []definitionSource {
	if len(sources) == 0 {
		return nil
	}
	merged := map[string]definitionSource{}
	for _, source := range sources {
		source = normalizeDefinitionSource(source)
		key := sourceIdentityKey(source)
		if key == "" {
			continue
		}
		if current, ok := merged[key]; ok {
			merged[key] = mergeDefinitionSource(current, source)
			continue
		}
		merged[key] = source
	}
	keys := make([]string, 0, len(merged))
	for key := range merged {
		keys = append(keys, key)
	}
	slices.SortFunc(keys, func(left, right string) int {
		return compareDefinitionSource(merged[left], merged[right])
	})
	out := make([]definitionSource, 0, len(keys))
	for _, key := range keys {
		out = append(out, merged[key])
	}
	return out
}

func cloneDefinitionSources(sources []definitionSource) []definitionSource {
	sources = normalizeDefinitionSources(sources)
	if len(sources) == 0 {
		return nil
	}
	out := make([]definitionSource, 0, len(sources))
	for _, source := range sources {
		out = append(out, definitionSource{
			vendorID:          source.vendorID,
			modelID:           source.modelID,
			sourceID:          source.sourceID,
			aliasID:           source.aliasID,
			kind:              source.kind,
			isDirect:          source.isDirect,
			sourceModelID:     source.sourceModelID,
			displayName:       source.displayName,
			definition:        cloneModelDefinition(source.definition),
			badges:            append([]string(nil), source.badges...),
			pricing:           cloneDefinitionSourcePricing(source.pricing),
			authorityPriority: source.authorityPriority,
		})
	}
	return out
}

func mergeDefinitionSources(left []definitionSource, right []definitionSource) []definitionSource {
	return normalizeDefinitionSources(append(append([]definitionSource(nil), left...), right...))
}

func normalizeDefinitionSource(source definitionSource) definitionSource {
	source.vendorID = normalizedVendorSlug(source.vendorID)
	source.modelID = strings.TrimSpace(source.modelID)
	source.sourceID = normalizeDefinitionSourceAliasID(source.sourceID)
	if source.sourceID == "" {
		source.sourceID = normalizeDefinitionSourceAliasID(source.aliasID)
	}
	source.aliasID = normalizeDefinitionSourceAliasID(source.aliasID)
	if source.aliasID == "" {
		source.aliasID = source.sourceID
	}
	source.kind = strings.TrimSpace(source.kind)
	if source.kind == "" {
		source.kind = definitionSourceKindPreset
	}
	source.sourceModelID = strings.TrimSpace(source.sourceModelID)
	source.displayName = strings.TrimSpace(source.displayName)
	source.definition = cloneModelDefinition(source.definition)
	source.badges = normalizeDefinitionSourceBadges(source.badges)
	source.pricing = normalizeDefinitionSourcePricing(source.pricing)
	if source.vendorID == "" || source.modelID == "" || source.aliasID == "" {
		return definitionSource{}
	}
	return source
}

func sourceIdentityKey(source definitionSource) string {
	source = normalizeDefinitionSource(source)
	if source.vendorID == "" || source.modelID == "" || source.aliasID == "" {
		return ""
	}
	return source.vendorID + "\x00" + source.modelID + "\x00" + source.aliasID + "\x00" + boolKey(source.isDirect)
}

func boolKey(value bool) string {
	if value {
		return "1"
	}
	return "0"
}

func mergeDefinitionSource(primary definitionSource, fallback definitionSource) definitionSource {
	primary = normalizeDefinitionSource(primary)
	fallback = normalizeDefinitionSource(fallback)
	if sourceIdentityKey(primary) == "" {
		return fallback
	}
	if sourceIdentityKey(fallback) == "" {
		return primary
	}
	if primary.sourceModelID == "" {
		primary.sourceModelID = fallback.sourceModelID
	}
	if primary.definition == nil {
		primary.definition = cloneModelDefinition(fallback.definition)
	} else {
		primary.definition = mergeDefinitionMetadata(primary.definition, fallback.definition)
	}
	if fallback.authorityPriority > primary.authorityPriority {
		primary.authorityPriority = fallback.authorityPriority
	}
	primary.badges = mergeDefinitionSourceBadges(primary.badges, fallback.badges)
	primary.pricing = mergeDefinitionSourcePricing(primary.pricing, fallback.pricing)
	return primary
}

func compareDefinitionSource(left definitionSource, right definitionSource) int {
	left = normalizeDefinitionSource(left)
	right = normalizeDefinitionSource(right)
	if left.isDirect != right.isDirect {
		if left.isDirect {
			return -1
		}
		return 1
	}
	if left.authorityPriority != right.authorityPriority {
		return int(right.authorityPriority - left.authorityPriority)
	}
	if value := strings.Compare(left.aliasID, right.aliasID); value != 0 {
		return value
	}
	if value := strings.Compare(left.vendorID, right.vendorID); value != 0 {
		return value
	}
	if value := strings.Compare(left.modelID, right.modelID); value != 0 {
		return value
	}
	return strings.Compare(left.sourceModelID, right.sourceModelID)
}

func cloneModelDefinition(in *modelv1.ModelDefinition) *modelv1.ModelDefinition {
	if in == nil {
		return nil
	}
	return proto.Clone(in).(*modelv1.ModelDefinition)
}
