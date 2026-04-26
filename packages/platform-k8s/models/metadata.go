package models

import (
	"crypto/sha256"
	"encoding/hex"
	"strings"

	modelv1 "code-code.internal/go-contract/model/v1"
)

const (
	LabelDefinitionSourceOwner = "model.code-code.internal/source-owner"
	LabelModelIDHash           = "model.code-code.internal/model-id-hash"
	LabelVendorIDHash          = "model.code-code.internal/vendor-id-hash"
	LabelSourceRefModelIDHash  = "model.code-code.internal/source-ref-model-id-hash"
	LabelSourceRefVendorIDHash = "model.code-code.internal/source-ref-vendor-id-hash"
	LabelAliasHashPrefix       = "model.code-code.internal/alias-"
	LabelBadgeHashPrefix       = "model.code-code.internal/badge-"

	definitionSourceOwnerVendorSupport = "vendor-support"
)

func VendorSupportDefinitionLabelsForDefinition(labels map[string]string, definition *modelv1.ModelDefinition) map[string]string {
	return VendorSupportDefinitionLabels(labels, definition, nil, nil)
}

func VendorSupportDefinitionLabels(labels map[string]string, definition *modelv1.ModelDefinition, sourceRef *modelv1.ModelRef, badges []string) map[string]string {
	return definitionLabelsForOwner(labels, definition, definitionSourceOwnerVendorSupport, sourceRef, badges)
}

func DefinitionSourceOwner(labels map[string]string) string {
	return strings.TrimSpace(labels[LabelDefinitionSourceOwner])
}

func IsVendorSupportManagedDefinition(labels map[string]string) bool {
	return DefinitionSourceOwner(labels) == definitionSourceOwnerVendorSupport
}

func definitionLabelsForOwner(labels map[string]string, definition *modelv1.ModelDefinition, owner string, sourceRef *modelv1.ModelRef, badges []string) map[string]string {
	out := cloneLabels(labels)
	delete(out, LabelDefinitionSourceOwner)
	delete(out, LabelModelIDHash)
	delete(out, LabelVendorIDHash)
	delete(out, LabelSourceRefModelIDHash)
	delete(out, LabelSourceRefVendorIDHash)
	for key := range out {
		if strings.HasPrefix(key, LabelAliasHashPrefix) ||
			strings.HasPrefix(key, LabelBadgeHashPrefix) {
			delete(out, key)
		}
	}
	if strings.TrimSpace(owner) != "" {
		out[LabelDefinitionSourceOwner] = owner
	}
	if modelID := strings.TrimSpace(definition.GetModelId()); modelID != "" {
		out[LabelModelIDHash] = modelIDLabelValue(modelID)
	}
	if vendorID := strings.TrimSpace(definition.GetVendorId()); vendorID != "" {
		out[LabelVendorIDHash] = vendorIDLabelValue(vendorID)
	}
	if sourceRef != nil {
		if vendorID := strings.TrimSpace(sourceRef.GetVendorId()); vendorID != "" {
			out[LabelSourceRefVendorIDHash] = vendorIDLabelValue(vendorID)
		}
		if modelID := strings.TrimSpace(sourceRef.GetModelId()); modelID != "" {
			out[LabelSourceRefModelIDHash] = modelIDLabelValue(modelID)
		}
	}
	for _, alias := range collectDefinitionAliases(definition) {
		out[aliasLabelKey(alias)] = "true"
	}
	for _, badge := range normalizeDefinitionSourceBadges(badges) {
		if key := badgeLabelKey(badge); key != "" {
			out[key] = "true"
		}
	}
	return out
}

func cloneLabels(labels map[string]string) map[string]string {
	out := map[string]string{}
	for key, value := range labels {
		out[key] = value
	}
	return out
}

func vendorIDLabelValue(vendorID string) string {
	return stableLabelHash(vendorID)
}

func modelIDLabelValue(modelID string) string {
	return stableLabelHash(modelID)
}

func stableLabelHash(value string) string {
	sum := sha256.Sum256([]byte(strings.TrimSpace(value)))
	return hex.EncodeToString(sum[:12])
}

func aliasLabelKey(alias string) string {
	sum := sha256.Sum256([]byte(strings.TrimSpace(alias)))
	return LabelAliasHashPrefix + hex.EncodeToString(sum[:12])
}

func badgeLabelKey(badge string) string {
	badge = normalizeDefinitionSourceBadge(badge)
	if badge == "" {
		return ""
	}
	return LabelBadgeHashPrefix + stableLabelHash(badge)
}
