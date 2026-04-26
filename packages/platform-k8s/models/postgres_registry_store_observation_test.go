package models

import (
	"testing"

	modelservicev1 "code-code.internal/go-contract/platform/model/v1"
)

func TestNormalizeRegistryObservationsDeduplicatesBySourceIDAndDirectness(t *testing.T) {
	t.Parallel()

	input := []*modelservicev1.RegistryModelSource{
		{
			SourceId:      "github-models",
			IsDirect:      true,
			SourceModelId: "deepseek-r1",
		},
		{
			SourceId:      "github-models",
			IsDirect:      true,
			SourceModelId: "deepseek-r1-alt",
		},
		{
			SourceId:      "github-models",
			IsDirect:      false,
			SourceModelId: "deepseek/deepseek-r1",
		},
		{
			SourceId:      "openrouter",
			IsDirect:      false,
			SourceModelId: "deepseek/deepseek-r1:free",
		},
	}

	normalized := normalizeRegistryObservations(input)
	if got, want := len(normalized), 3; got != want {
		t.Fatalf("len(normalized) = %d, want %d", got, want)
	}
	if got, want := normalized[0].GetSourceModelId(), "deepseek-r1"; got != want {
		t.Fatalf("first github source_model_id = %q, want %q", got, want)
	}
	if got, want := normalized[1].GetIsDirect(), false; got != want {
		t.Fatalf("second github is_direct = %v, want %v", got, want)
	}
	if got, want := normalized[2].GetSourceId(), "openrouter"; got != want {
		t.Fatalf("third source_id = %q, want %q", got, want)
	}
}
