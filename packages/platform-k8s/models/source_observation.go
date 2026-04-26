package models

import (
	"strings"

	modelv1 "code-code.internal/go-contract/model/v1"
)

func specSourceDefinition(source definitionSource) *modelv1.ModelDefinition {
	if source.definition != nil {
		return cloneModelDefinition(source.definition)
	}
	modelID := strings.TrimSpace(source.modelID)
	if source.vendorID == "" || modelID == "" {
		return nil
	}
	definition := &modelv1.ModelDefinition{
		VendorId: source.vendorID,
		ModelId:  modelID,
	}
	if source.displayName != "" {
		definition.DisplayName = source.displayName
	}
	return definition
}

func specSourceModelID(source definitionSource, definition *modelv1.ModelDefinition) string {
	if sourceModelID := strings.TrimSpace(source.sourceModelID); sourceModelID != "" {
		return sourceModelID
	}
	if definition != nil {
		return strings.TrimSpace(definition.GetModelId())
	}
	return strings.TrimSpace(source.modelID)
}
