package inputv1

import (
	"fmt"

	jsonschema "github.com/santhosh-tekuri/jsonschema/v6"
)

// ValidateInputSchema validates one provider-facing input schema.
func ValidateInputSchema(schema *InputSchema) error {
	if schema == nil {
		return fmt.Errorf("inputv1: input schema is nil")
	}
	if schema.Format == InputSchemaFormat_INPUT_SCHEMA_FORMAT_UNSPECIFIED {
		return fmt.Errorf("inputv1: input schema format is unspecified")
	}
	if schema.Schema == nil {
		return fmt.Errorf("inputv1: input schema payload is nil")
	}
	switch schema.Format {
	case InputSchemaFormat_INPUT_SCHEMA_FORMAT_JSON_SCHEMA:
		if schema.JsonSchemaDialect == "" {
			return fmt.Errorf("inputv1: json schema dialect is empty")
		}
		if _, err := compileInputSchema(schema); err != nil {
			return err
		}
	default:
		return fmt.Errorf("inputv1: input schema format %d is invalid", schema.Format)
	}
	return nil
}

// ValidateRunInput validates one provider-facing run input against one input schema.
func ValidateRunInput(input *RunInput, schema *InputSchema) error {
	if input == nil {
		return fmt.Errorf("inputv1: run input is nil")
	}
	compiled, err := compileInputSchema(schema)
	if err != nil {
		return err
	}
	instance := map[string]any{}
	if input.Parameters != nil {
		instance = input.Parameters.AsMap()
	}
	if err := compiled.Validate(instance); err != nil {
		return fmt.Errorf("inputv1: run input parameters do not match input schema: %w", err)
	}
	return nil
}

func compileInputSchema(schema *InputSchema) (*jsonschema.Schema, error) {
	if schema == nil {
		return nil, fmt.Errorf("inputv1: input schema is nil")
	}
	doc := schema.Schema.AsMap()
	if existingDialect, ok := doc["$schema"]; ok {
		existingDialectString, ok := existingDialect.(string)
		if !ok {
			return nil, fmt.Errorf("inputv1: schema $schema must be a string")
		}
		if existingDialectString != schema.JsonSchemaDialect {
			return nil, fmt.Errorf("inputv1: schema $schema %q does not match json_schema_dialect %q", existingDialectString, schema.JsonSchemaDialect)
		}
	} else {
		doc["$schema"] = schema.JsonSchemaDialect
	}

	compiler := jsonschema.NewCompiler()
	if err := compiler.AddResource("urn:agent-input-schema", doc); err != nil {
		return nil, fmt.Errorf("inputv1: invalid input schema resource: %w", err)
	}
	compiled, err := compiler.Compile("urn:agent-input-schema")
	if err != nil {
		return nil, fmt.Errorf("inputv1: invalid input schema: %w", err)
	}
	return compiled, nil
}
