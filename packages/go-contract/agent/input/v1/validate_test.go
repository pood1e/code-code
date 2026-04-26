package inputv1

import (
	"testing"

	structpb "google.golang.org/protobuf/types/known/structpb"
)

func TestValidateInputSchemaAcceptsJSONSchema(t *testing.T) {
	t.Parallel()

	schema := &InputSchema{
		Format:            InputSchemaFormat_INPUT_SCHEMA_FORMAT_JSON_SCHEMA,
		Schema:            mustStruct(t, map[string]any{"type": "object"}),
		JsonSchemaDialect: "https://json-schema.org/draft/2020-12/schema",
	}

	if err := ValidateInputSchema(schema); err != nil {
		t.Fatalf("ValidateInputSchema() error = %v", err)
	}
}

func TestValidateInputSchemaRejectsMissingDialect(t *testing.T) {
	t.Parallel()

	schema := &InputSchema{
		Format: InputSchemaFormat_INPUT_SCHEMA_FORMAT_JSON_SCHEMA,
		Schema: mustStruct(t, map[string]any{"type": "object"}),
	}

	if err := ValidateInputSchema(schema); err == nil {
		t.Fatal("ValidateInputSchema() expected error, got nil")
	}
}

func TestValidateRunInputAcceptsMatchingParameters(t *testing.T) {
	t.Parallel()

	schema := &InputSchema{
		Format: InputSchemaFormat_INPUT_SCHEMA_FORMAT_JSON_SCHEMA,
		Schema: mustStruct(t, map[string]any{
			"type": "object",
			"properties": map[string]any{
				"temperature": map[string]any{"type": "number"},
			},
			"required": []any{"temperature"},
		}),
		JsonSchemaDialect: "https://json-schema.org/draft/2020-12/schema",
	}
	input := &RunInput{
		Parameters: mustStruct(t, map[string]any{
			"temperature": 0.7,
		}),
	}

	if err := ValidateRunInput(input, schema); err != nil {
		t.Fatalf("ValidateRunInput() error = %v", err)
	}
}

func TestValidateRunInputRejectsNil(t *testing.T) {
	t.Parallel()

	schema := &InputSchema{
		Format:            InputSchemaFormat_INPUT_SCHEMA_FORMAT_JSON_SCHEMA,
		Schema:            mustStruct(t, map[string]any{"type": "object"}),
		JsonSchemaDialect: "https://json-schema.org/draft/2020-12/schema",
	}

	if err := ValidateRunInput(nil, schema); err == nil {
		t.Fatal("ValidateRunInput() expected error, got nil")
	}
}

func TestValidateRunInputRejectsSchemaMismatch(t *testing.T) {
	t.Parallel()

	schema := &InputSchema{
		Format: InputSchemaFormat_INPUT_SCHEMA_FORMAT_JSON_SCHEMA,
		Schema: mustStruct(t, map[string]any{
			"type": "object",
			"properties": map[string]any{
				"temperature": map[string]any{"type": "number"},
			},
			"required": []any{"temperature"},
		}),
		JsonSchemaDialect: "https://json-schema.org/draft/2020-12/schema",
	}
	input := &RunInput{
		Parameters: mustStruct(t, map[string]any{
			"temperature": "hot",
		}),
	}

	if err := ValidateRunInput(input, schema); err == nil {
		t.Fatal("ValidateRunInput() expected error, got nil")
	}
}

func TestValidateInputSchemaRejectsMismatchedSchemaDialect(t *testing.T) {
	t.Parallel()

	schema := &InputSchema{
		Format: InputSchemaFormat_INPUT_SCHEMA_FORMAT_JSON_SCHEMA,
		Schema: mustStruct(t, map[string]any{
			"$schema": "https://json-schema.org/draft/2019-09/schema",
			"type":    "object",
		}),
		JsonSchemaDialect: "https://json-schema.org/draft/2020-12/schema",
	}

	if err := ValidateInputSchema(schema); err == nil {
		t.Fatal("ValidateInputSchema() expected error, got nil")
	}
}

func mustStruct(t *testing.T, value map[string]any) *structpb.Struct {
	t.Helper()

	s, err := structpb.NewStruct(value)
	if err != nil {
		t.Fatalf("structpb.NewStruct() error = %v", err)
	}
	return s
}
