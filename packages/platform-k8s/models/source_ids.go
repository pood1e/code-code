package models

func normalizeDefinitionSourceID(sourceID string) string {
	spec, ok := lookupDefinitionSourceCollector(sourceID)
	if !ok {
		return ""
	}
	return spec.sourceID
}

func normalizeDefinitionSourceIDs(sourceIDs []string) []string {
	if len(sourceIDs) == 0 {
		return nil
	}
	seen := map[string]struct{}{}
	out := make([]string, 0, len(sourceIDs))
	for _, sourceID := range sourceIDs {
		normalized := normalizeDefinitionSourceID(sourceID)
		if normalized == "" {
			continue
		}
		if _, ok := seen[normalized]; ok {
			continue
		}
		seen[normalized] = struct{}{}
		out = append(out, normalized)
	}
	return out
}
