package models

import "strings"

func definitionSourceAuthorityPriority(aliasID string) int {
	spec, ok := lookupDefinitionSourceCollector(aliasID)
	if !ok {
		return 0
	}
	return spec.authorityPriority
}

func collectedDefinitionAuthorityPriority(item collectedDefinition) int {
	priority := 0
	for _, source := range item.sources {
		if candidate := definitionSourcePriority(source); candidate > priority {
			priority = candidate
		}
	}
	return priority
}

func collectedDefinitionAuthorityAliasID(item collectedDefinition) string {
	bestPriority := -1
	bestAliasID := ""
	for _, source := range item.sources {
		priority := definitionSourcePriority(source)
		aliasID := normalizeDefinitionSourceAliasID(source.aliasID)
		if priority > bestPriority || (priority == bestPriority && compareSourceID(aliasID, bestAliasID) < 0) {
			bestPriority = priority
			bestAliasID = aliasID
		}
	}
	return bestAliasID
}

func compareCollectedDefinitionAuthority(left collectedDefinition, right collectedDefinition) int {
	leftPriority := collectedDefinitionAuthorityPriority(left)
	rightPriority := collectedDefinitionAuthorityPriority(right)
	if leftPriority != rightPriority {
		if leftPriority > rightPriority {
			return -1
		}
		return 1
	}
	return compareSourceID(collectedDefinitionAuthorityAliasID(left), collectedDefinitionAuthorityAliasID(right))
}

func compareSourceID(left string, right string) int {
	left = strings.TrimSpace(left)
	right = strings.TrimSpace(right)
	switch {
	case left == right:
		return 0
	case left == "":
		return 1
	case right == "":
		return -1
	default:
		return strings.Compare(left, right)
	}
}

func definitionSourcePriority(source definitionSource) int {
	if source.authorityPriority > 0 {
		return int(source.authorityPriority)
	}
	return definitionSourceAuthorityPriority(source.aliasID)
}
