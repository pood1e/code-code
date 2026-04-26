package models

import (
	"strings"

	modelv1 "code-code.internal/go-contract/model/v1"
)

func normalizeExternalHostedDefinitions[T any](
	sourceID string,
	items []T,
	scope configuredVendorScope,
	knownCanonicalModelIDs map[string]map[string]struct{},
	project func(T) (string, string, string, bool, bool),
) map[string][]collectedDefinition {
	byVendor := map[string]map[string]collectedDefinition{}
	for _, item := range items {
		owner, rawModelID, displayName, isDirect, ok := project(item)
		if !ok {
			continue
		}
		vendorID, ok := normalizeCollectedVendorID(owner, scope)
		if !ok {
			continue
		}
		modelID, aliases, ok := normalizeExternalModelIdentity(vendorID, rawModelID, knownCanonicalModelIDs[vendorID])
		if !ok {
			continue
		}
		candidate := collectedDefinition{
			definition: &modelv1.ModelDefinition{
				ModelId:     modelID,
				DisplayName: strings.TrimSpace(displayName),
				VendorId:    vendorID,
				Aliases:     aliases,
			},
			sources: []definitionSource{newDefinitionSource(
				vendorID,
				rawModelID,
				sourceID,
				isDirect,
				strings.TrimSpace(displayName),
				nil,
				nil,
			)},
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
