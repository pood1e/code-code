package modelv1

import (
	"fmt"
	"strings"
	"unicode"

	fieldmaskpb "google.golang.org/protobuf/types/known/fieldmaskpb"
)

// ValidateRef validates one default model reference.
func ValidateRef(ref *ModelRef) error {
	if ref == nil {
		return fmt.Errorf("modelv1: model ref is nil")
	}
	if ref.ModelId == "" {
		return fmt.Errorf("modelv1: model ref id is empty")
	}
	if ref.VendorId == "" {
		return fmt.Errorf("modelv1: model ref vendor id is empty")
	}
	return nil
}

// ValidateDefinition validates one canonical model version.
func ValidateDefinition(definition *ModelVersion) error {
	if definition == nil {
		return fmt.Errorf("modelv1: model definition is nil")
	}
	if definition.ModelId == "" {
		return fmt.Errorf("modelv1: model definition id is empty")
	}
	if definition.PrimaryShape == ModelShape_MODEL_SHAPE_UNSPECIFIED {
		return fmt.Errorf("modelv1: model primary shape is unspecified")
	}
	if err := validateAliases(definition.Aliases); err != nil {
		return err
	}
	if err := validateCapabilities(definition.Capabilities); err != nil {
		return err
	}
	if err := validateShapes(definition.PrimaryShape, definition.SupportedShapes); err != nil {
		return err
	}
	if err := validateModalities("input", definition.InputModalities); err != nil {
		return err
	}
	if err := validateModalities("output", definition.OutputModalities); err != nil {
		return err
	}
	if strings.TrimSpace(definition.GetVendorId()) == "" {
		return fmt.Errorf("modelv1: model vendor id is empty")
	}
	if err := validateSurfaceIdentity(definition.GetVendorId(), definition.GetModelId()); err != nil {
		return err
	}
	return nil
}

// ValidateOverride validates one provider-supplied model override.
func ValidateOverride(override *ModelOverride) error {
	if override == nil {
		return fmt.Errorf("modelv1: model override is nil")
	}
	if err := validateOverrideFieldMask(override.FieldMask); err != nil {
		return err
	}
	if override.PrimaryShape != nil && *override.PrimaryShape == ModelShape_MODEL_SHAPE_UNSPECIFIED {
		return fmt.Errorf("modelv1: override primary shape is unspecified")
	}
	if err := validateCapabilities(override.Capabilities); err != nil {
		return err
	}
	if override.PrimaryShape != nil {
		if err := validateShapes(*override.PrimaryShape, override.SupportedShapes); err != nil {
			return err
		}
	} else if err := validateShapeList("supported shape", override.SupportedShapes); err != nil {
		return err
	}
	if err := validateModalities("input", override.InputModalities); err != nil {
		return err
	}
	if err := validateModalities("output", override.OutputModalities); err != nil {
		return err
	}
	return nil
}

func validateOverrideFieldMask(mask *fieldmaskpb.FieldMask) error {
	if mask == nil {
		return fmt.Errorf("modelv1: model override field_mask is nil")
	}
	paths := mask.GetPaths()
	if len(paths) == 0 {
		return fmt.Errorf("modelv1: model override field_mask is empty")
	}
	allowed := map[string]struct{}{
		"display_name":      {},
		"context_spec":      {},
		"capabilities":      {},
		"primary_shape":     {},
		"supported_shapes":  {},
		"input_modalities":  {},
		"output_modalities": {},
	}
	seen := map[string]struct{}{}
	normalized := make([]string, 0, len(paths))
	for _, path := range paths {
		if path == "" {
			return fmt.Errorf("modelv1: model override field_mask contains empty path")
		}
		if strings.Contains(path, ".") {
			return fmt.Errorf("modelv1: model override field_mask path %q must reference a top-level field", path)
		}
		path = normalizeFieldMaskPath(path)
		if _, ok := allowed[path]; !ok {
			return fmt.Errorf("modelv1: model override field_mask path %q is not allowed", path)
		}
		if _, ok := seen[path]; ok {
			return fmt.Errorf("modelv1: model override field_mask path %q is duplicated", path)
		}
		seen[path] = struct{}{}
		normalized = append(normalized, path)
	}
	mask.Paths = normalized
	return nil
}

func normalizeFieldMaskPath(path string) string {
	var b strings.Builder
	for i, r := range path {
		if unicode.IsUpper(r) {
			if i > 0 {
				b.WriteByte('_')
			}
			b.WriteRune(unicode.ToLower(r))
			continue
		}
		b.WriteRune(r)
	}
	return b.String()
}

// ValidateResolvedModel validates one effective resolved model.
func ValidateResolvedModel(resolved *ResolvedModel) error {
	if resolved == nil {
		return fmt.Errorf("modelv1: resolved model is nil")
	}
	if resolved.ModelId == "" {
		return fmt.Errorf("modelv1: resolved model id is empty")
	}
	if resolved.EffectiveDefinition == nil {
		return fmt.Errorf("modelv1: resolved model effective_definition is nil")
	}
	if err := ValidateDefinition(resolved.EffectiveDefinition); err != nil {
		return fmt.Errorf("modelv1: resolved model effective_definition is invalid: %w", err)
	}
	if resolved.EffectiveDefinition.ModelId != resolved.ModelId {
		return fmt.Errorf("modelv1: resolved model id %q does not match effective definition id %q", resolved.ModelId, resolved.EffectiveDefinition.ModelId)
	}
	return nil
}

func validateAliases(aliases []*ModelAlias) error {
	for _, alias := range aliases {
		if alias == nil {
			return fmt.Errorf("modelv1: model alias is nil")
		}
		if alias.Kind == AliasKind_ALIAS_KIND_UNSPECIFIED {
			return fmt.Errorf("modelv1: model alias kind is unspecified")
		}
		if alias.Value == "" {
			return fmt.Errorf("modelv1: model alias value is empty")
		}
	}
	return nil
}

func validateCapabilities(capabilities []ModelCapability) error {
	for _, capability := range capabilities {
		if capability == ModelCapability_MODEL_CAPABILITY_UNSPECIFIED {
			return fmt.Errorf("modelv1: model capability is unspecified")
		}
	}
	return nil
}

func validateShapes(primary ModelShape, supported []ModelShape) error {
	if err := validateShapeList("supported shape", supported); err != nil {
		return err
	}
	if len(supported) > 0 && !containsShape(supported, primary) {
		return fmt.Errorf("modelv1: supported shapes do not include primary shape %s", primary.String())
	}
	return nil
}

func validateShapeList(label string, shapes []ModelShape) error {
	for _, shape := range shapes {
		if shape == ModelShape_MODEL_SHAPE_UNSPECIFIED {
			return fmt.Errorf("modelv1: %s is unspecified", label)
		}
	}
	return nil
}

func validateModalities(direction string, modalities []Modality) error {
	for _, modality := range modalities {
		if modality == Modality_MODALITY_UNSPECIFIED {
			return fmt.Errorf("modelv1: %s modality is unspecified", direction)
		}
	}
	return nil
}

func containsShape(values []ModelShape, target ModelShape) bool {
	for _, value := range values {
		if value == target {
			return true
		}
	}
	return false
}

func validateSurfaceIdentity(vendorID string, modelID string) error {
	vendorID = strings.TrimSpace(vendorID)
	modelID = strings.TrimSpace(modelID)
	if vendorID == "" {
		return fmt.Errorf("modelv1: model vendor id is empty")
	}
	if modelID == "" {
		return fmt.Errorf("modelv1: model id is empty")
	}
	return nil
}
