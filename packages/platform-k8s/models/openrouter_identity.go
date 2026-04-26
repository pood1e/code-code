package models

import (
	"strings"

	modelv1 "code-code.internal/go-contract/model/v1"
)

type openRouterIdentity struct {
	modelID string
	aliases []*modelv1.ModelAlias
}

func normalizeOpenRouterIdentity(
	sourceID string,
	canonicalSourceID string,
	scope configuredVendorScope,
	knownCanonicalModelIDs map[string]map[string]struct{},
) (string, openRouterIdentity, bool) {
	sourcePrefix, sourceModelID, ok := parseOpenRouterVendorModelID(sourceID)
	if !ok {
		return "", openRouterIdentity{}, false
	}
	vendorID, ok := normalizeOpenRouterVendorID(sourcePrefix, scope)
	if !ok {
		return "", openRouterIdentity{}, false
	}
	sourceModelID, _ = splitOpenRouterRouteVariant(sourceModelID)
	if sourceModelID == "" || isOpenRouterChannelModel(sourceModelID) {
		return "", openRouterIdentity{}, false
	}
	modelID, aliases, ok := normalizeExternalModelIdentity(vendorID, sourceModelID, knownCanonicalModelIDs[vendorID])
	if !ok {
		return "", openRouterIdentity{}, false
	}

	canonicalModelID := ""
	if canonicalPrefix, candidateModelID, ok := parseOpenRouterVendorModelID(canonicalSourceID); ok {
		if canonicalVendorID, vendorOK := normalizeOpenRouterVendorID(canonicalPrefix, scope); vendorOK && canonicalVendorID == vendorID {
			canonicalModelID = stripOpenRouterRouteVariant(candidateModelID)
		}
	}

	return vendorID, openRouterIdentity{
		modelID: modelID,
		aliases: mergeDefinitionAliases(aliases, buildOpenRouterAliases(modelID, canonicalModelID)),
	}, true
}

func parseOpenRouterVendorModelID(value string) (string, string, bool) {
	prefix, modelID, ok := strings.Cut(strings.TrimSpace(value), "/")
	if !ok {
		return "", "", false
	}
	prefix = strings.TrimSpace(prefix)
	modelID = strings.TrimSpace(modelID)
	if prefix == "" || modelID == "" {
		return "", "", false
	}
	return prefix, modelID, true
}

func stripOpenRouterRouteVariant(modelID string) string {
	base, _ := splitOpenRouterRouteVariant(modelID)
	return base
}

func splitOpenRouterRouteVariant(modelID string) (string, string) {
	base, variant, ok := strings.Cut(strings.TrimSpace(modelID), ":")
	if !ok {
		return strings.TrimSpace(modelID), ""
	}
	return strings.TrimSpace(base), strings.TrimSpace(variant)
}

func openRouterSourceBadges(routeVariant string) []string {
	if strings.TrimSpace(strings.ToLower(routeVariant)) == SourceBadgeFree {
		return []string{SourceBadgeFree}
	}
	return nil
}

func isOpenRouterChannelModel(modelID string) bool {
	return hasChannelToken(modelID)
}

func hasChannelToken(value string) bool {
	for _, token := range strings.FieldsFunc(strings.ToLower(strings.TrimSpace(value)), splitOpenRouterModelToken) {
		switch token {
		case "preview", "latest", "experimental":
			return true
		}
	}
	return false
}

func splitOpenRouterModelToken(r rune) bool {
	switch r {
	case '-', '_', '.', '/', ':', ' ', '(', ')':
		return true
	default:
		return false
	}
}

func buildOpenRouterAliases(modelID string, canonicalModelID string) []*modelv1.ModelAlias {
	if strings.TrimSpace(canonicalModelID) == "" || strings.TrimSpace(canonicalModelID) == strings.TrimSpace(modelID) {
		return nil
	}
	kind := modelv1.AliasKind_ALIAS_KIND_STABLE
	if hasSnapshotReleaseSuffix(canonicalModelID) {
		kind = modelv1.AliasKind_ALIAS_KIND_SNAPSHOT
	}
	return []*modelv1.ModelAlias{{
		Kind:  kind,
		Value: canonicalModelID,
	}}
}

func hasPreciseDateSuffix(modelID string) bool {
	if base, _, ok := cutPreciseDateSuffix(modelID); ok {
		return strings.TrimSpace(base) != ""
	}
	return false
}

func cutPreciseDateSuffix(modelID string) (string, string, bool) {
	modelID = strings.TrimSpace(modelID)
	if len(modelID) > len("-YYYY-MM-DD") {
		if year, month, day, ok := trailingDateParts(modelID, 10, true); ok {
			_ = year
			_ = month
			_ = day
			return strings.TrimSpace(modelID[:len(modelID)-11]), modelID[len(modelID)-10:], true
		}
	}
	if len(modelID) > len("-YYYYMMDD") {
		if year, month, day, ok := trailingDateParts(modelID, 8, false); ok {
			_ = year
			_ = month
			_ = day
			return strings.TrimSpace(modelID[:len(modelID)-9]), modelID[len(modelID)-8:], true
		}
	}
	return "", "", false
}

func trailingDateParts(value string, digits int, dashed bool) (string, string, string, bool) {
	if dashed {
		if len(value) < digits+1 || value[len(value)-11] != '-' {
			return "", "", "", false
		}
		date := value[len(value)-10:]
		if date[4] != '-' || date[7] != '-' {
			return "", "", "", false
		}
		year, month, day := date[:4], date[5:7], date[8:10]
		return year, month, day, isValidDateParts(year, month, day)
	}
	if len(value) < digits+1 || value[len(value)-9] != '-' {
		return "", "", "", false
	}
	date := value[len(value)-8:]
	year, month, day := date[:4], date[4:6], date[6:8]
	return year, month, day, isValidDateParts(year, month, day)
}

func isValidDateParts(year string, month string, day string) bool {
	return len(year) == 4 && len(month) == 2 && len(day) == 2 &&
		allDigits(year) && allDigits(month) && allDigits(day) &&
		month >= "01" && month <= "12" &&
		day >= "01" && day <= "31"
}

func allDigits(value string) bool {
	if value == "" {
		return false
	}
	for _, r := range value {
		if r < '0' || r > '9' {
			return false
		}
	}
	return true
}
