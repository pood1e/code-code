package models

import "testing"

func TestNormalizeDefinitionSourceIDs(t *testing.T) {
	t.Parallel()

	got := normalizeDefinitionSourceIDs([]string{
		" NVIDIA-INTEGRATE ",
		"openrouter",
		"openrouter",
		"unknown",
	})

	want := []string{SourceIDNVIDIAIntegrate, SourceIDOpenRouter}
	if !equalStrings(got, want) {
		t.Fatalf("normalizeDefinitionSourceIDs() = %#v, want %#v", got, want)
	}
}
