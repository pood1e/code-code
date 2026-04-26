package agui

import (
	"testing"
	"time"

	aguievents "github.com/ag-ui-protocol/ag-ui/sdks/community/go/pkg/core/events"
)

func TestRunOutputWrapsAGUIEvent(t *testing.T) {
	output, err := RunOutput(7, time.Unix(1710000000, 0), aguievents.NewTextMessageContentEvent("msg-1", "hello"))
	if err != nil {
		t.Fatalf("RunOutput() error = %v", err)
	}
	if got := EventType(output); got != aguievents.EventTypeTextMessageContent {
		t.Fatalf("event type = %q, want %q", got, aguievents.EventTypeTextMessageContent)
	}
	if output.GetTimestamp() == nil || output.GetEvent() == nil {
		t.Fatalf("output timestamp/event should be set")
	}
}

func TestEventFromOutputUsesOfficialAGUIValidation(t *testing.T) {
	output, err := RunOutput(7, time.Unix(1710000000, 0), aguievents.NewToolCallResultEvent("tool-message-1", "tool-1", "done"))
	if err != nil {
		t.Fatalf("RunOutput() error = %v", err)
	}
	event, err := EventFromOutput(output)
	if err != nil {
		t.Fatalf("EventFromOutput() error = %v", err)
	}
	if got, want := event.Type(), aguievents.EventTypeToolCallResult; got != want {
		t.Fatalf("event type = %q, want %q", got, want)
	}
}

func TestEventFromOutputSupportsToolCallChunk(t *testing.T) {
	output, err := RunOutput(7, time.Unix(1710000000, 0), aguievents.NewToolCallChunkEvent().WithToolCallChunkID("tool-1"))
	if err != nil {
		t.Fatalf("RunOutput() error = %v", err)
	}
	event, err := EventFromOutput(output)
	if err != nil {
		t.Fatalf("EventFromOutput() error = %v", err)
	}
	if got, want := event.Type(), aguievents.EventTypeToolCallChunk; got != want {
		t.Fatalf("event type = %q, want %q", got, want)
	}
}

func TestRunStartedPayloadIncludesSerializationFields(t *testing.T) {
	payload := RunStartedPayload(" thread-1 ", " run-1 ", " parent-1 ", map[string]any{"messages": []any{}})
	if payload["type"] != string(aguievents.EventTypeRunStarted) {
		t.Fatalf("type = %v, want RUN_STARTED", payload["type"])
	}
	if payload["threadId"] != "thread-1" {
		t.Fatalf("threadId = %v, want thread-1", payload["threadId"])
	}
	if payload["runId"] != "run-1" {
		t.Fatalf("runId = %v, want run-1", payload["runId"])
	}
	if payload["parentRunId"] != "parent-1" {
		t.Fatalf("parentRunId = %v, want parent-1", payload["parentRunId"])
	}
	if payload["input"] == nil {
		t.Fatalf("input should be included")
	}
}

func TestIsRealtimeEventTypeDoesNotIncludeDeprecatedThinkingEvents(t *testing.T) {
	for _, eventType := range []aguievents.EventType{
		aguievents.EventTypeStateSnapshot,
		aguievents.EventTypeStateDelta,
		aguievents.EventTypeActivitySnapshot,
		aguievents.EventTypeActivityDelta,
	} {
		if !IsRealtimeEventType(eventType) {
			t.Fatalf("%s should be realtime", eventType)
		}
	}
	if !IsRealtimeEventType(aguievents.EventTypeReasoningMessageContent) {
		t.Fatalf("reasoning content should be realtime")
	}
	if IsRealtimeEventType(aguievents.EventTypeThinkingTextMessageContent) {
		t.Fatalf("deprecated thinking content should not be realtime")
	}
}
