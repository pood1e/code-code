package qwen

import (
	"testing"
	"time"

	"code-code.internal/cli-output-sidecar/internal/parsertest"
)

func TestInlineThinkingStreamHandlesSplitTags(t *testing.T) {
	stream := &inlineThinkingStream{}

	reasoning, assistant := stream.Append("<thi")
	if reasoning != "" || assistant != "" {
		t.Fatalf("first append = (%q, %q), want empty", reasoning, assistant)
	}

	reasoning, assistant = stream.Append("nk>thought</th")
	if reasoning != "thought" || assistant != "" {
		t.Fatalf("second append = (%q, %q)", reasoning, assistant)
	}

	reasoning, assistant = stream.Append("ink>\n\npong")
	if reasoning != "" || assistant != "pong" {
		t.Fatalf("third append = (%q, %q), want empty reasoning and pong assistant", reasoning, assistant)
	}
}

func TestQwenNormalizesInlineThinkingFromTextDelta(t *testing.T) {
	parser := New()
	now := time.Unix(1710000000, 0)

	_, err := parser.ParseLine([]byte(`{"type":"stream_event","event":{"type":"content_block_delta","delta":{"type":"text_delta","text":"<think>\nThe user"}}}`), now)
	if err != nil {
		t.Fatalf("first delta err = %v", err)
	}
	snapshot := parser.Snapshot()
	if snapshot.ReasoningText != "\nThe user" {
		t.Fatalf("reasoning after first delta = %q, want %q", snapshot.ReasoningText, "\nThe user")
	}
	if snapshot.AssistantText != "" {
		t.Fatalf("assistant after first delta = %q, want empty", snapshot.AssistantText)
	}

	_, err = parser.ParseLine([]byte(`{"type":"stream_event","event":{"type":"content_block_delta","delta":{"type":"text_delta","text":" wants me to reply with exactly \"pong\".\n</think>\n\npong"}}}`), now)
	if err != nil {
		t.Fatalf("second delta err = %v", err)
	}
	snapshot = parser.Snapshot()
	if snapshot.ReasoningText != "\nThe user wants me to reply with exactly \"pong\".\n" {
		t.Fatalf("reasoning after second delta = %q", snapshot.ReasoningText)
	}
	if snapshot.AssistantText != "pong" {
		t.Fatalf("assistant after second delta = %q, want pong", snapshot.AssistantText)
	}

	outputs, err := parser.ParseLine([]byte(`{"type":"assistant","message":{"content":[{"type":"text","text":"<think>\nThe user wants me to reply with exactly \"pong\".\n</think>\n\npong"}],"usage":{"input_tokens":12,"output_tokens":4}}}`), now)
	if err != nil {
		t.Fatalf("assistant err = %v", err)
	}
	if len(outputs) != 1 || parsertest.EventType(outputs[0]) != "CUSTOM" || parsertest.EventString(outputs[0], "name") != "run.turn_usage" {
		t.Fatalf("assistant outputs = %#v, want one turn usage custom event", outputs)
	}

	outputs, err = parser.ParseLine([]byte(`{"type":"result","result":"<think>\nThe user wants me to reply with exactly \"pong\".\n</think>\n\npong"}`), now)
	if err != nil {
		t.Fatalf("result err = %v", err)
	}
	if len(outputs) != 3 {
		t.Fatalf("len(outputs) = %d, want 3", len(outputs))
	}
	if got, want := parsertest.EventType(outputs[0]), "REASONING_MESSAGE_END"; got != want {
		t.Fatalf("outputs[0] type = %q, want %q", got, want)
	}
	if got, want := parsertest.EventType(outputs[1]), "REASONING_END"; got != want {
		t.Fatalf("outputs[1] type = %q, want %q", got, want)
	}
	if got, want := parsertest.EventType(outputs[2]), "TEXT_MESSAGE_END"; got != want {
		t.Fatalf("outputs[2] type = %q, want %q", got, want)
	}
}

func TestQwenPreservesExplicitThinkingDelta(t *testing.T) {
	parser := New()
	now := time.Unix(1710000000, 0)

	outputs, err := parser.ParseLine([]byte(`{"type":"stream_event","event":{"type":"content_block_delta","delta":{"type":"thinking_delta","thinking":"thought"}}}`), now)
	if err != nil {
		t.Fatalf("thinking delta err = %v", err)
	}
	if len(outputs) != 3 || parsertest.EventType(outputs[0]) != "REASONING_START" || parsertest.EventType(outputs[1]) != "REASONING_MESSAGE_START" || parsertest.EventString(outputs[2], "delta") != "thought" {
		t.Fatalf("thinking outputs = %#v", outputs)
	}

	outputs, err = parser.ParseLine([]byte(`{"type":"stream_event","event":{"type":"content_block_delta","delta":{"type":"text_delta","text":"pong"}}}`), now)
	if err != nil {
		t.Fatalf("text delta err = %v", err)
	}
	if len(outputs) != 2 || parsertest.EventType(outputs[0]) != "TEXT_MESSAGE_START" || parsertest.EventString(outputs[1], "delta") != "pong" {
		t.Fatalf("assistant outputs = %#v", outputs)
	}

	outputs, err = parser.ParseLine([]byte(`{"type":"result","result":"pong"}`), now)
	if err != nil {
		t.Fatalf("result err = %v", err)
	}
	if len(outputs) != 3 {
		t.Fatalf("len(outputs) = %d, want 3", len(outputs))
	}
	if got, want := parsertest.EventType(outputs[0]), "REASONING_MESSAGE_END"; got != want {
		t.Fatalf("outputs[0] type = %q, want %q", got, want)
	}
	if got, want := parsertest.EventType(outputs[1]), "REASONING_END"; got != want {
		t.Fatalf("outputs[1] type = %q, want %q", got, want)
	}
	if got, want := parsertest.EventType(outputs[2]), "TEXT_MESSAGE_END"; got != want {
		t.Fatalf("outputs[2] type = %q, want %q", got, want)
	}
}

func TestQwenPrefersExplicitResultText(t *testing.T) {
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
