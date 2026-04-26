package parser

import (
	"testing"
	"time"

	"code-code.internal/cli-output-sidecar/internal/parsertest"
)

func TestBuilderSyncAssistantPrefersDeltaAndFallsBackToFull(t *testing.T) {
	builder := NewBuilder()
	now := time.Unix(1710000000, 0)

	first := builder.SyncAssistant("hello", now)
	if len(first) != 2 {
		t.Fatalf("len(first) = %d, want 2", len(first))
	}
	if got, want := parsertest.EventType(first[0]), "TEXT_MESSAGE_START"; got != want {
		t.Fatalf("first[0] type = %q, want %q", got, want)
	}
	if got, want := parsertest.EventString(first[1], "delta"), "hello"; got != want {
		t.Fatalf("first delta = %q, want %q", got, want)
	}

	second := builder.SyncAssistant("hello world", now)
	if len(second) != 1 {
		t.Fatalf("len(second) = %d, want 1", len(second))
	}
	if got := parsertest.EventString(second[0], "delta"); got != " world" {
		t.Fatalf("delta = %q, want %q", got, " world")
	}

	third := builder.SyncAssistant("reset", now)
	if len(third) != 3 {
		t.Fatalf("len(third) = %d, want 3", len(third))
	}
	if got, want := parsertest.EventType(third[0]), "TEXT_MESSAGE_END"; got != want {
		t.Fatalf("third[0] type = %q, want %q", got, want)
	}
	if got, want := parsertest.EventType(third[1]), "TEXT_MESSAGE_START"; got != want {
		t.Fatalf("third[1] type = %q, want %q", got, want)
	}
	if got := parsertest.EventString(third[2], "delta"); got != "reset" {
		t.Fatalf("assistant delta = %q, want %q", got, "reset")
	}
}

func TestBuilderReasoningWrapsMessageInReasoningPhase(t *testing.T) {
	builder := NewBuilder()
	now := time.Unix(1710000000, 0)

	first := builder.SyncReasoning("think", now)
	if len(first) != 3 {
		t.Fatalf("len(first) = %d, want 3", len(first))
	}
	if got, want := parsertest.EventType(first[0]), "REASONING_START"; got != want {
		t.Fatalf("first[0] type = %q, want %q", got, want)
	}
	if got, want := parsertest.EventType(first[1]), "REASONING_MESSAGE_START"; got != want {
		t.Fatalf("first[1] type = %q, want %q", got, want)
	}
	if got, want := parsertest.EventString(first[2], "delta"), "think"; got != want {
		t.Fatalf("first delta = %q, want %q", got, want)
	}

	second := builder.SyncReasoning("thinking", now)
	if len(second) != 1 {
		t.Fatalf("len(second) = %d, want 1", len(second))
	}
	if got, want := parsertest.EventString(second[0], "delta"), "ing"; got != want {
		t.Fatalf("second delta = %q, want %q", got, want)
	}

	closed := builder.ResultReasoning("", now)
	if len(closed) != 2 {
		t.Fatalf("len(closed) = %d, want 2", len(closed))
	}
	if got, want := parsertest.EventType(closed[0]), "REASONING_MESSAGE_END"; got != want {
		t.Fatalf("closed[0] type = %q, want %q", got, want)
	}
	if got, want := parsertest.EventType(closed[1]), "REASONING_END"; got != want {
		t.Fatalf("closed[1] type = %q, want %q", got, want)
	}
}

func TestBuilderToolCallSetsParentMessageID(t *testing.T) {
	builder := NewBuilder()
	now := time.Unix(1710000000, 0)

	outputs := builder.ToolCall("shell", "tool-1", "ls", now)
	if len(outputs) != 4 {
		t.Fatalf("len(outputs) = %d, want 4", len(outputs))
	}
	if got, want := parsertest.EventType(outputs[0]), "TOOL_CALL_START"; got != want {
		t.Fatalf("tool start type = %q, want %q", got, want)
	}
	if got, want := parsertest.EventString(outputs[0], "parentMessageId"), "assistant-message"; got != want {
		t.Fatalf("parentMessageId = %q, want %q", got, want)
	}
	if got, want := parsertest.EventString(outputs[1], "delta"), `{"summary":"ls"}`; got != want {
		t.Fatalf("tool args delta = %q, want %q", got, want)
	}
	if got, want := parsertest.EventString(outputs[3], "content"), `{"summary":"ls"}`; got != want {
		t.Fatalf("tool result content = %q, want %q", got, want)
	}
}
