package models

import "strings"

func normalizeNVIDIADefinitions(
	items []nvidiaModel,
	scope configuredVendorScope,
	knownCanonicalModelIDs map[string]map[string]struct{},
) map[string][]collectedDefinition {
	return normalizeExternalHostedDefinitions(SourceIDNVIDIAIntegrate, items, scope, knownCanonicalModelIDs, func(item nvidiaModel) (string, string, string, bool, bool) {
		owner, rawModelID, ok := strings.Cut(strings.TrimSpace(item.ID), "/")
		if !ok {
			return "", "", "", false, false
		}
		if ownedBy := strings.TrimSpace(item.OwnedBy); ownedBy != "" {
			owner = ownedBy
		}
		if shouldSkipNVIDIAModel(rawModelID) {
			return "", "", "", false, false
		}
		return owner, rawModelID, rawModelID, true, true
	})
}

func shouldSkipNVIDIAModel(rawModelID string) bool {
	if hasChannelToken(rawModelID) {
		return true
	}
	return hasModelToken(rawModelID,
		"asr",
		"calibration",
		"clip",
		"embed",
		"embedcode",
		"embedding",
		"embedqa",
		"guard",
		"moderation",
		"nemoguard",
		"nvclip",
		"parse",
		"pii",
		"rerank",
		"retriever",
		"reward",
		"safety",
		"transcribe",
		"translate",
		"tts",
	)
}
