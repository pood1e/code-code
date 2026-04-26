package models

import (
	"slices"
	"strings"
)

const (
	SourceBadgeFree = "free"
)

type definitionSourcePricing struct {
	Input           string `json:"input,omitempty"`
	Output          string `json:"output,omitempty"`
	CacheReadInput  string `json:"cacheReadInput,omitempty"`
	CacheWriteInput string `json:"cacheWriteInput,omitempty"`
}

func normalizeDefinitionSourceBadges(badges []string) []string {
	if len(badges) == 0 {
		return nil
	}
	out := make([]string, 0, len(badges))
	seen := map[string]struct{}{}
	for _, badge := range badges {
		badge = normalizeDefinitionSourceBadge(badge)
		if badge == "" {
			continue
		}
		if _, ok := seen[badge]; ok {
			continue
		}
		seen[badge] = struct{}{}
		out = append(out, badge)
	}
	slices.Sort(out)
	return out
}

func normalizeDefinitionSourceBadge(badge string) string {
	switch strings.TrimSpace(strings.ToLower(badge)) {
	case SourceBadgeFree:
		return SourceBadgeFree
	default:
		return ""
	}
}

func mergeDefinitionSourceBadges(left []string, right []string) []string {
	return normalizeDefinitionSourceBadges(append(append([]string(nil), left...), right...))
}

func normalizeDefinitionSourcePricing(pricing *definitionSourcePricing) *definitionSourcePricing {
	if pricing == nil {
		return nil
	}
	normalized := &definitionSourcePricing{
		Input:           strings.TrimSpace(pricing.Input),
		Output:          strings.TrimSpace(pricing.Output),
		CacheReadInput:  strings.TrimSpace(pricing.CacheReadInput),
		CacheWriteInput: strings.TrimSpace(pricing.CacheWriteInput),
	}
	if normalized.Input == "" && normalized.Output == "" && normalized.CacheReadInput == "" && normalized.CacheWriteInput == "" {
		return nil
	}
	return normalized
}

func cloneDefinitionSourcePricing(pricing *definitionSourcePricing) *definitionSourcePricing {
	pricing = normalizeDefinitionSourcePricing(pricing)
	if pricing == nil {
		return nil
	}
	return &definitionSourcePricing{
		Input:           pricing.Input,
		Output:          pricing.Output,
		CacheReadInput:  pricing.CacheReadInput,
		CacheWriteInput: pricing.CacheWriteInput,
	}
}

func mergeDefinitionSourcePricing(primary *definitionSourcePricing, fallback *definitionSourcePricing) *definitionSourcePricing {
	primary = cloneDefinitionSourcePricing(primary)
	fallback = normalizeDefinitionSourcePricing(fallback)
	if primary == nil {
		return cloneDefinitionSourcePricing(fallback)
	}
	if fallback == nil {
		return primary
	}
	if primary.Input == "" {
		primary.Input = fallback.Input
	}
	if primary.Output == "" {
		primary.Output = fallback.Output
	}
	if primary.CacheReadInput == "" {
		primary.CacheReadInput = fallback.CacheReadInput
	}
	if primary.CacheWriteInput == "" {
		primary.CacheWriteInput = fallback.CacheWriteInput
	}
	return normalizeDefinitionSourcePricing(primary)
}
