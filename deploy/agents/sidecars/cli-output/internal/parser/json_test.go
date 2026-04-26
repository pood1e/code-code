package parser

import "testing"

func TestStringValuePreservesWhitespace(t *testing.T) {
	payload := map[string]any{"text": " leading and trailing "}
	if got := StringValue(payload, "text"); got != " leading and trailing " {
		t.Fatalf("StringValue() = %q, want %q", got, " leading and trailing ")
	}
}
