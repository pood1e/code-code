package models

func newDefinitionSource(
	vendorID string,
	modelID string,
	aliasID string,
	isDirect bool,
	displayName string,
	badges []string,
	pricing *definitionSourcePricing,
) definitionSource {
	return definitionSource{
		vendorID:    vendorID,
		modelID:     modelID,
		sourceID:    aliasID,
		aliasID:     aliasID,
		kind:        definitionSourceKindPreset,
		isDirect:    isDirect,
		displayName: displayName,
		badges:      append([]string(nil), badges...),
		pricing:     cloneDefinitionSourcePricing(pricing),
	}
}
