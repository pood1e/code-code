package models

import (
	"strings"

	modelv1 "code-code.internal/go-contract/model/v1"
)

func normalizeExternalModelIdentity(vendorID string, rawModelID string, knownCanonicalModelIDs map[string]struct{}) (string, []*modelv1.ModelAlias, bool) {
	rawModelID = normalizeExternalModelSlug(rawModelID)
	if rawModelID == "" || hasChannelToken(rawModelID) {
		return "", nil, false
	}

	candidates := externalModelCandidates(rawModelID)
	for _, candidate := range candidates {
		if _, ok := knownCanonicalModelIDs[candidate]; ok {
			return candidate, buildExternalAliases(candidate, rawModelID), true
		}
	}
	for _, candidate := range candidates {
		if candidate != rawModelID {
			return candidate, buildExternalAliases(candidate, rawModelID), true
		}
	}
	return rawModelID, nil, true
}

func normalizeExternalModelSlug(raw string) string {
	raw = strings.TrimSpace(strings.ToLower(raw))
	replacer := strings.NewReplacer(
		"_", "-",
		" ", "-",
		"/", "-",
	)
	raw = replacer.Replace(raw)
	for strings.Contains(raw, "--") {
		raw = strings.ReplaceAll(raw, "--", "-")
	}
	raw = strings.Trim(raw, "-")
	switch {
	case strings.HasPrefix(raw, "qwen-3-"):
		return "qwen3-" + strings.TrimPrefix(raw, "qwen-3-")
	case strings.HasPrefix(raw, "qwen-3."):
		return "qwen3." + strings.TrimPrefix(raw, "qwen-3.")
	default:
		return raw
	}
}

func externalModelCandidates(raw string) []string {
	out := make([]string, 0, 4)
	appendCandidate := func(candidate string) {
		candidate = strings.TrimSpace(candidate)
		if candidate == "" {
			return
		}
		for _, existing := range out {
			if existing == candidate {
				return
			}
		}
		out = append(out, candidate)
	}
	if base, _, ok := cutPreciseDateSuffix(raw); ok {
		appendCandidate(base)
	}
	if base, _, ok := cutCalendarReleaseSuffix(raw); ok {
		appendCandidate(base)
		appendCandidate(strings.TrimSuffix(base, "-instruct"))
	}
	if base, _, ok := cutReleaseSuffix(raw); ok {
		appendCandidate(base)
		appendCandidate(strings.TrimSuffix(base, "-instruct"))
	}
	appendCandidate(raw)
	return out
}

func buildExternalAliases(modelID string, raw string) []*modelv1.ModelAlias {
	modelID = strings.TrimSpace(modelID)
	raw = strings.TrimSpace(raw)
	if modelID == "" || raw == "" || modelID == raw {
		return nil
	}
	kind := modelv1.AliasKind_ALIAS_KIND_STABLE
	if hasSnapshotReleaseSuffix(raw) {
		kind = modelv1.AliasKind_ALIAS_KIND_SNAPSHOT
	}
	return []*modelv1.ModelAlias{{
		Kind:  kind,
		Value: raw,
	}}
}

func hasSnapshotReleaseSuffix(modelID string) bool {
	return hasPreciseDateSuffix(modelID) || hasCalendarReleaseSuffix(modelID) || hasReleaseSuffix(modelID)
}

func cutCalendarReleaseSuffix(modelID string) (string, string, bool) {
	modelID = strings.TrimSpace(modelID)
	if len(modelID) > len("-MM-YYYY") {
		if _, _, ok := trailingMonthYearSuffix(modelID); ok {
			return strings.TrimSpace(modelID[:len(modelID)-8]), modelID[len(modelID)-7:], true
		}
	}
	if len(modelID) > len("-YYYY-MM") {
		if _, _, ok := trailingYearMonthSuffix(modelID); ok {
			return strings.TrimSpace(modelID[:len(modelID)-8]), modelID[len(modelID)-7:], true
		}
	}
	return "", "", false
}

func hasCalendarReleaseSuffix(modelID string) bool {
	base, _, ok := cutCalendarReleaseSuffix(modelID)
	return ok && strings.TrimSpace(base) != ""
}

func cutReleaseSuffix(modelID string) (string, string, bool) {
	modelID = strings.TrimSpace(modelID)
	if len(modelID) <= len("-0000") {
		return "", "", false
	}
	lastDash := strings.LastIndex(modelID, "-")
	if lastDash <= 0 || lastDash == len(modelID)-1 {
		return "", "", false
	}
	suffix := modelID[lastDash+1:]
	if len(suffix) != 4 || !allDigits(suffix) {
		return "", "", false
	}
	return strings.TrimSpace(modelID[:lastDash]), suffix, true
}

func hasReleaseSuffix(modelID string) bool {
	base, _, ok := cutReleaseSuffix(modelID)
	return ok && strings.TrimSpace(base) != ""
}

func trailingMonthYearSuffix(value string) (string, string, bool) {
	if len(value) < len("-MM-YYYY") || value[len(value)-8] != '-' {
		return "", "", false
	}
	suffix := value[len(value)-7:]
	if suffix[2] != '-' {
		return "", "", false
	}
	month := suffix[:2]
	year := suffix[3:]
	return year, month, isValidMonthParts(year, month)
}

func trailingYearMonthSuffix(value string) (string, string, bool) {
	if len(value) < len("-YYYY-MM") || value[len(value)-8] != '-' {
		return "", "", false
	}
	suffix := value[len(value)-7:]
	if suffix[4] != '-' {
		return "", "", false
	}
	year := suffix[:4]
	month := suffix[5:]
	return year, month, isValidMonthParts(year, month)
}

func isValidMonthParts(year string, month string) bool {
	return len(year) == 4 && len(month) == 2 &&
		allDigits(year) && allDigits(month) &&
		month >= "01" && month <= "12"
}
