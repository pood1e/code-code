package policyv1

import (
	"fmt"

	modelv1 "code-code.internal/go-contract/model/v1"
)

// ValidateProviderFilter validates one agent provider filter.
func ValidateProviderFilter(filter *ProviderFilter) error {
	if filter == nil {
		return fmt.Errorf("policyv1: provider filter is nil")
	}
	for _, surfaceID := range filter.AllowedSurfaceIds {
		if surfaceID == "" {
			return fmt.Errorf("policyv1: allowed surface id is empty")
		}
	}
	for _, capability := range filter.RequiredModelCapabilities {
		if capability == modelv1.ModelCapability_MODEL_CAPABILITY_UNSPECIFIED {
			return fmt.Errorf("policyv1: required model capability is unspecified")
		}
	}
	return nil
}
