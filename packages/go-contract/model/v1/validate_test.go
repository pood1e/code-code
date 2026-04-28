package modelv1

import (
	"testing"

	fieldmaskpb "google.golang.org/protobuf/types/known/fieldmaskpb"
)

func TestValidateRefRejectsEmptyID(t *testing.T) {
	t.Parallel()

	if err := ValidateRef(&ModelRef{}); err == nil {
		t.Fatal("ValidateRef() expected error, got nil")
	}
}

func TestValidateDefinitionAcceptsMinimalDefinition(t *testing.T) {
	t.Parallel()

	definition := &ModelVersion{
		ModelId:      "gpt-5",
		VendorId:     "openai",
		PrimaryShape: ModelShape_MODEL_SHAPE_RESPONSES,
	}

	if err := ValidateDefinition(definition); err != nil {
		t.Fatalf("ValidateDefinition() error = %v", err)
	}
}

func TestValidateDefinitionRejectsSupportedShapesWithoutPrimary(t *testing.T) {
	t.Parallel()

	definition := &ModelVersion{
		ModelId:         "gpt-5",
		VendorId:        "openai",
		PrimaryShape:    ModelShape_MODEL_SHAPE_RESPONSES,
		SupportedShapes: []ModelShape{ModelShape_MODEL_SHAPE_CHAT_COMPLETIONS},
	}

	if err := ValidateDefinition(definition); err == nil {
		t.Fatal("ValidateDefinition() expected error, got nil")
	}
}

func TestValidateOverrideRejectsUnspecifiedCapability(t *testing.T) {
	t.Parallel()

	override := &ModelOverride{
		FieldMask: &fieldmaskpb.FieldMask{
			Paths: []string{"capabilities"},
		},
		Capabilities: []ModelCapability{ModelCapability_MODEL_CAPABILITY_UNSPECIFIED},
	}

	if err := ValidateOverride(override); err == nil {
		t.Fatal("ValidateOverride() expected error, got nil")
	}
}

func TestValidateResolvedModelRejectsMismatchedModelID(t *testing.T) {
	t.Parallel()

	resolved := &ResolvedModel{
		ModelId: "gpt-5",
		EffectiveDefinition: &ModelVersion{
			ModelId:      "gpt-4o",
			VendorId:     "openai",
			PrimaryShape: ModelShape_MODEL_SHAPE_RESPONSES,
		},
	}

	if err := ValidateResolvedModel(resolved); err == nil {
		t.Fatal("ValidateResolvedModel() expected error, got nil")
	}
}

func TestValidateResolvedModelAcceptsValidResolvedModel(t *testing.T) {
	t.Parallel()

	resolved := &ResolvedModel{
		ModelId: "gpt-5",
		EffectiveDefinition: &ModelVersion{
			ModelId:         "gpt-5",
			VendorId:        "openai",
			PrimaryShape:    ModelShape_MODEL_SHAPE_RESPONSES,
			SupportedShapes: []ModelShape{ModelShape_MODEL_SHAPE_RESPONSES},
		},
	}

	if err := ValidateResolvedModel(resolved); err != nil {
		t.Fatalf("ValidateResolvedModel() error = %v", err)
	}
}

func TestValidateDefinitionRejectsEmptyVendorID(t *testing.T) {
	t.Parallel()

	definition := &ModelVersion{
		ModelId:      "gpt-5",
		PrimaryShape: ModelShape_MODEL_SHAPE_RESPONSES,
	}

	if err := ValidateDefinition(definition); err == nil {
		t.Fatal("ValidateDefinition() expected error, got nil")
	}
}

func TestValidateOverrideRejectsEmptyFieldMask(t *testing.T) {
	t.Parallel()

	if err := ValidateOverride(&ModelOverride{}); err == nil {
		t.Fatal("ValidateOverride() expected error, got nil")
	}
}

func TestValidateOverrideRejectsNestedFieldMaskPath(t *testing.T) {
	t.Parallel()

	override := &ModelOverride{
		FieldMask: &fieldmaskpb.FieldMask{
			Paths: []string{"display_name.value"},
		},
	}

	if err := ValidateOverride(override); err == nil {
		t.Fatal("ValidateOverride() expected error, got nil")
	}
}

func TestValidateOverrideNormalizesCamelCaseFieldMaskPath(t *testing.T) {
	t.Parallel()

	override := &ModelOverride{
		FieldMask: &fieldmaskpb.FieldMask{
			Paths: []string{"displayName", "contextSpec"},
		},
	}

	if err := ValidateOverride(override); err != nil {
		t.Fatalf("ValidateOverride() error = %v", err)
	}
	if got, want := override.FieldMask.Paths[0], "display_name"; got != want {
		t.Fatalf("normalized path[0] = %q, want %q", got, want)
	}
	if got, want := override.FieldMask.Paths[1], "context_spec"; got != want {
		t.Fatalf("normalized path[1] = %q, want %q", got, want)
	}
}
