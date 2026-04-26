package gemini

import (
	"testing"
	"time"

	"code-code.internal/cli-output-sidecar/internal/parsertest"
)

func TestGeminiFallsBackToAccumulatorOnResult(t *testing.T) {
	parser := New()
	now := time.Unix(1710000000, 0)

	_, err := parser.ParseLine([]byte(`{"type":"message","role":"assistant","content":"hello","delta":true}`), now)
	if err != nil {
		t.Fatalf("message err = %v", err)
	}

	outputs, err := parser.ParseLine([]byte(`{"type":"result","stats":{"input_token_count":12,"output_token_count":4}}`), now)
	if err != nil {
		t.Fatalf("result err = %v", err)
	}
	if len(outputs) != 2 {
		t.Fatalf("len(outputs) = %d, want 2", len(outputs))
	}
	if got, want := parsertest.EventType(outputs[0]), "CUSTOM"; got != want {
		t.Fatalf("outputs[0] type = %q, want %q", got, want)
	}
	if got, want := parsertest.EventType(outputs[1]), "TEXT_MESSAGE_END"; got != want {
		t.Fatalf("outputs[1] type = %q, want %q", got, want)
	}
}
