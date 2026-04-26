package agui

import (
	"encoding/json"
	"testing"

	aguitypes "github.com/ag-ui-protocol/ag-ui/sdks/community/go/pkg/core/types"
)

func TestTextMessageProducesValidAGUIMessage(t *testing.T) {
	message, err := TextMessage("msg-1", string(aguitypes.RoleUser), "hello")
	if err != nil {
		t.Fatalf("TextMessage() error = %v", err)
	}
	raw, err := MessageRaw(message)
	if err != nil {
		t.Fatalf("MessageRaw() error = %v", err)
	}
	var payload map[string]any
	if err := json.Unmarshal(raw, &payload); err != nil {
		t.Fatalf("json.Unmarshal() error = %v", err)
	}
	if payload["role"] != string(aguitypes.RoleUser) {
		t.Fatalf("role = %v, want user", payload["role"])
	}
}

func TestMessageStructFromRawValidatesAndNormalizesMessage(t *testing.T) {
	payload, err := MessageStructFromRaw(json.RawMessage(`{"id":" msg-1 ","role":"user","content":"hello"}`))
	if err != nil {
		t.Fatalf("MessageStructFromRaw() error = %v", err)
	}
	message, err := MessageFromStruct(payload)
	if err != nil {
		t.Fatalf("MessageFromStruct() error = %v", err)
	}
	if message.ID != "msg-1" {
		t.Fatalf("id = %q, want msg-1", message.ID)
	}
}

func TestToolMessageProducesValidAGUIMessage(t *testing.T) {
	message, err := ToolMessage("tool-message-1", "tool-1", `{"summary":"done"}`)
	if err != nil {
		t.Fatalf("ToolMessage() error = %v", err)
	}
	if message.Role != aguitypes.RoleTool {
		t.Fatalf("role = %q, want tool", message.Role)
	}
	if message.ToolCallID != "tool-1" {
		t.Fatalf("toolCallId = %q, want tool-1", message.ToolCallID)
	}
	if _, err := MessageRaw(message); err != nil {
		t.Fatalf("MessageRaw() error = %v", err)
	}
}

func TestAssistantMessageProducesValidToolCalls(t *testing.T) {
	message, err := AssistantMessage("assistant-1", "", []aguitypes.ToolCall{{
		ID:   "tool-1",
		Type: aguitypes.ToolCallTypeFunction,
		Function: aguitypes.FunctionCall{
			Name:      "shell",
			Arguments: `{"cmd":"ls"}`,
		},
	}})
	if err != nil {
		t.Fatalf("AssistantMessage() error = %v", err)
	}
	if message.Role != aguitypes.RoleAssistant {
		t.Fatalf("role = %q, want assistant", message.Role)
	}
	if len(message.ToolCalls) != 1 {
		t.Fatalf("tool_calls length = %d, want 1", len(message.ToolCalls))
	}
	if _, err := MessageRaw(message); err != nil {
		t.Fatalf("MessageRaw() error = %v", err)
	}
}

func TestLatestUserTextReadsMultimodalTextParts(t *testing.T) {
	text, err := LatestUserText([]aguitypes.Message{{
		ID:   "msg-1",
		Role: aguitypes.RoleUser,
		Content: []any{
			map[string]any{"type": "text", "text": "hello "},
			map[string]any{"type": "text", "text": "world"},
		},
	}})
	if err != nil {
		t.Fatalf("LatestUserText() error = %v", err)
	}
	if text != "hello world" {
		t.Fatalf("text = %q, want hello world", text)
	}
}
