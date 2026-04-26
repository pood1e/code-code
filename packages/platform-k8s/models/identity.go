package models

import (
	"fmt"
	"strings"

	modelv1 "code-code.internal/go-contract/model/v1"
)

type surfaceIdentity struct {
	vendorID string
	modelID  string
}

func newSurfaceIdentity(vendorID string, modelID string) (surfaceIdentity, error) {
	vendorID = strings.TrimSpace(vendorID)
	modelID = strings.TrimSpace(modelID)
	if vendorID == "" {
		return surfaceIdentity{}, fmt.Errorf("platformk8s/models: vendor id is empty")
	}
	if modelID == "" {
		return surfaceIdentity{}, fmt.Errorf("platformk8s/models: model id is empty")
	}
	return surfaceIdentity{
		vendorID: vendorID,
		modelID:  modelID,
	}, nil
}

func identityFromDefinition(definition *modelv1.ModelDefinition) (surfaceIdentity, error) {
	if definition == nil {
		return surfaceIdentity{}, fmt.Errorf("platformk8s/models: model definition is nil")
	}
	return newSurfaceIdentity(definition.GetVendorId(), definition.GetModelId())
}

func identityKey(vendorID string, modelID string) string {
	return strings.TrimSpace(vendorID) + "\x00" + strings.TrimSpace(modelID)
}

func (i surfaceIdentity) key() string {
	return identityKey(i.vendorID, i.modelID)
}
