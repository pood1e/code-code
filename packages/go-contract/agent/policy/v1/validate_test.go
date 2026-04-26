package policyv1

import (
	"testing"

	modelv1 "code-code.internal/go-contract/model/v1"
)

func TestValidateProviderFilterAcceptsMinimalFilter(t *testing.T) {
	t.Parallel()

	filter := &ProviderFilter{
		AllowedSurfaceIds: []string{"openai-compatible"},
		RequiredModelCapabilities: []modelv1.ModelCapability{
			modelv1.ModelCapability_MODEL_CAPABILITY_TOOL_CALLING,
		},
	}

	if err := ValidateProviderFilter(filter); err != nil {
		t.Fatalf("ValidateProviderFilter() error = %v", err)
	}
}

func TestValidateProviderFilterRejectsEmptySurfaceID(t *testing.T) {
	t.Parallel()

	filter := &ProviderFilter{
		AllowedSurfaceIds: []string{"openai-compatible", ""},
	}

	if err := ValidateProviderFilter(filter); err == nil {
		t.Fatal("ValidateProviderFilter() expected error, got nil")
	}
}

func TestValidateProviderFilterRejectsUnspecifiedCapability(t *testing.T) {
	t.Parallel()

	filter := &ProviderFilter{
		RequiredModelCapabilities: []modelv1.ModelCapability{
			modelv1.ModelCapability_MODEL_CAPABILITY_UNSPECIFIED,
		},
	}

	if err := ValidateProviderFilter(filter); err == nil {
		t.Fatal("ValidateProviderFilter() expected error, got nil")
	}
}
