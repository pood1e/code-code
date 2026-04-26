package models

import (
	"strings"

	modelv1 "code-code.internal/go-contract/model/v1"
	modelservicev1 "code-code.internal/go-contract/platform/model/v1"
	"google.golang.org/protobuf/proto"
)

type storedDefinition struct {
	Identity   surfaceIdentity
	Definition *modelv1.ModelDefinition
}

func newModelRegistryEntry(
	definition *modelv1.ModelDefinition,
	sourceRef *modelv1.ModelRef,
	sources []definitionSource,
	badges []string,
	pricing *definitionSourcePricing,
) *modelservicev1.ModelRegistryEntry {
	return &modelservicev1.ModelRegistryEntry{
		Definition: cloneModelDefinition(definition),
		SourceRef:  cloneModelRef(sourceRef),
		Badges:     normalizeDefinitionSourceBadges(badges),
		Pricing:    protoDefinitionPricing(pricing),
		Sources:    protoRegistrySourcesFromDefinitionSources(sources),
	}
}

func protoRegistrySourcesFromDefinitionSources(sources []definitionSource) []*modelservicev1.RegistryModelSource {
	sources = normalizeDefinitionSources(sources)
	if len(sources) == 0 {
		return nil
	}
	out := make([]*modelservicev1.RegistryModelSource, 0, len(sources))
	for _, source := range sources {
		source = normalizeDefinitionSource(source)
		definition := specSourceDefinition(source)
		out = append(out, normalizeRegistryModelSource(&modelservicev1.RegistryModelSource{
			SourceId:      source.aliasID,
			Kind:          source.kind,
			IsDirect:      source.isDirect,
			SourceModelId: specSourceModelID(source, definition),
			Definition:    definition,
			Badges:        normalizeDefinitionSourceBadges(source.badges),
			Pricing:       protoDefinitionPricing(source.pricing),
		}))
	}
	return out
}

func normalizeRegistryModelSource(source *modelservicev1.RegistryModelSource) *modelservicev1.RegistryModelSource {
	if source == nil {
		return nil
	}
	out := proto.Clone(source).(*modelservicev1.RegistryModelSource)
	out.SourceId = normalizeDefinitionSourceAliasID(out.GetSourceId())
	out.Kind = strings.TrimSpace(out.GetKind())
	if out.Kind == "" {
		out.Kind = definitionSourceKindPreset
	}
	out.SourceModelId = strings.TrimSpace(out.GetSourceModelId())
	out.Badges = normalizeDefinitionSourceBadges(out.GetBadges())
	if out.Pricing != nil {
		out.Pricing = protoDefinitionPricing(definitionSourcePricingFromProto(out.GetPricing()))
	}
	if out.Definition != nil {
		out.Definition = cloneModelDefinition(out.GetDefinition())
	}
	return out
}

func cloneModelRegistryEntry(entry *modelservicev1.ModelRegistryEntry) *modelservicev1.ModelRegistryEntry {
	if entry == nil {
		return nil
	}
	return proto.Clone(entry).(*modelservicev1.ModelRegistryEntry)
}

func definitionSourcePricingFromProto(pricing *modelservicev1.RegistryModelPricing) *definitionSourcePricing {
	if pricing == nil {
		return nil
	}
	return normalizeDefinitionSourcePricing(&definitionSourcePricing{
		Input:           pricing.GetInput(),
		Output:          pricing.GetOutput(),
		CacheReadInput:  pricing.GetCacheReadInput(),
		CacheWriteInput: pricing.GetCacheWriteInput(),
	})
}
