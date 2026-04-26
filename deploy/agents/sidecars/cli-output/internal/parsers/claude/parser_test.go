package claude

import (
	"testing"
	"time"

	"code-code.internal/cli-output-sidecar/internal/parsertest"
)

func TestClaudePrefersExplicitResultText(t *testing.T) {
	parser := New()
	now := time.Unix(1710000000, 0)

	_, err := parser.ParseLine([]byte(`{"type":"stream_event","event":{"type":"content_block_delta","delta":{"type":"text_delta","text":"hel"}}}`), now)
	if err != nil {
		t.Fatalf("delta err = %v", err)
	}

	outputs, err := parser.ParseLine([]byte(`{"type":"result","result":"hello"}`), now)
	if err != nil {
		t.Fatalf("result err = %v", err)
	}
	if len(outputs) != 2 {
		t.Fatalf("len(outputs) = %d, want 2", len(outputs))
	}
	if got, want := parsertest.EventString(outputs[0], "delta"), "lo"; got != want {
		t.Fatalf("assistant delta = %q, want %q", got, want)
	}
	if got, want := parsertest.EventType(outputs[1]), "TEXT_MESSAGE_END"; got != want {
		t.Fatalf("end type = %q, want %q", got, want)
	}
}
