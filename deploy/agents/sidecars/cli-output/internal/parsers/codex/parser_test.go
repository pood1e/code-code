package codex

import (
	"testing"
	"time"

	"code-code.internal/cli-output-sidecar/internal/parsertest"
)

func TestCodexUsesAccumulatorForFinalResult(t *testing.T) {
	parser := New()
	now := time.Unix(1710000000, 0)

	outputs, err := parser.ParseLine([]byte(`{"type":"item.updated","item":{"id":"item-1","type":"agent_message","text":"hello"}}`), now)
	if err != nil || len(outputs) != 2 || parsertest.EventType(outputs[0]) != "TEXT_MESSAGE_START" || parsertest.EventString(outputs[1], "delta") != "hello" {
		t.Fatalf("first parse = %#v, err=%v", outputs, err)
	}

	outputs, err = parser.ParseLine([]byte(`{"type":"turn.completed","usage":{"input_tokens":10,"output_tokens":5,"request_count":1}}`), now)
	if err != nil {
		t.Fatalf("turn.completed err = %v", err)
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
