package agui

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	outputv1 "code-code.internal/go-contract/agent/output/v1"
	aguievents "github.com/ag-ui-protocol/ag-ui/sdks/community/go/pkg/core/events"
	"google.golang.org/protobuf/types/known/structpb"
	"google.golang.org/protobuf/types/known/timestamppb"
)

const (
	CustomRunLLMUsage      = "run.llm_usage"
	CustomRunTurnUsage     = "run.turn_usage"
	CustomRunOutputInvalid = "run.output.invalid"
)

func RunStartedPayload(threadID, runID, parentRunID string, input any) map[string]any {
	payload := map[string]any{
		"type":     string(aguievents.EventTypeRunStarted),
		"threadId": strings.TrimSpace(threadID),
		"runId":    strings.TrimSpace(runID),
	}
	if parentRunID = strings.TrimSpace(parentRunID); parentRunID != "" {
		payload["parentRunId"] = parentRunID
	}
	if input != nil {
		payload["input"] = input
	}
	return payload
}

func EventStruct(event aguievents.Event, at time.Time) (*structpb.Struct, error) {
	if event == nil {
		return nil, fmt.Errorf("ag-ui event is nil")
	}
	if !at.IsZero() {
		event.SetTimestamp(at.UTC().UnixMilli())
	}
	if err := event.Validate(); err != nil {
		return nil, err
	}
	body, err := event.ToJSON()
	if err != nil {
		return nil, err
	}
	var payload map[string]any
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, err
	}
	return structpb.NewStruct(payload)
}

func RunOutput(sequence uint64, at time.Time, event aguievents.Event) (*outputv1.RunOutput, error) {
	payload, err := EventStruct(event, at)
	if err != nil {
		return nil, err
	}
	return &outputv1.RunOutput{
		Sequence:  sequence,
		Timestamp: timestamppb.New(at.UTC()),
		Event:     payload,
	}, nil
}

func StructJSON(event *structpb.Struct) ([]byte, error) {
	if event == nil {
		return []byte("{}"), nil
	}
	return json.Marshal(event.AsMap())
}

func EventFromStruct(event *structpb.Struct) (aguievents.Event, error) {
	payload, err := StructJSON(event)
	if err != nil {
		return nil, err
	}
	decoded, err := aguievents.EventFromJSON(payload)
	if err != nil {
		decoded, err = eventFromJSONFallback(payload, err)
		if err != nil {
			return nil, err
		}
	}
	if err := decoded.Validate(); err != nil {
		return nil, err
	}
	return decoded, nil
}

func eventFromJSONFallback(payload []byte, original error) (aguievents.Event, error) {
	var base struct {
		Type aguievents.EventType `json:"type"`
	}
	if err := json.Unmarshal(payload, &base); err != nil {
		return nil, original
	}
	switch base.Type {
	case aguievents.EventTypeToolCallChunk:
		var event aguievents.ToolCallChunkEvent
		if err := json.Unmarshal(payload, &event); err != nil {
			return nil, err
		}
		return &event, nil
	default:
		return nil, original
	}
}

func EventFromOutput(output *outputv1.RunOutput) (aguievents.Event, error) {
	if output == nil {
		return nil, fmt.Errorf("run output is nil")
	}
	return EventFromStruct(output.GetEvent())
}

func EventType(output *outputv1.RunOutput) aguievents.EventType {
	if output == nil {
		return aguievents.EventTypeUnknown
	}
	return StructEventType(output.GetEvent())
}

func StructEventType(event *structpb.Struct) aguievents.EventType {
	if event == nil {
		return aguievents.EventTypeUnknown
	}
	return aguievents.EventType(strings.TrimSpace(event.GetFields()["type"].GetStringValue()))
}

func IsRealtimeOutput(output *outputv1.RunOutput) bool {
	return IsRealtimeEventType(EventType(output))
}

func IsRealtimeEventType(eventType aguievents.EventType) bool {
	switch eventType {
	case aguievents.EventTypeTextMessageStart,
		aguievents.EventTypeTextMessageContent,
		aguievents.EventTypeTextMessageEnd,
		aguievents.EventTypeTextMessageChunk,
		aguievents.EventTypeToolCallStart,
		aguievents.EventTypeToolCallArgs,
		aguievents.EventTypeToolCallEnd,
		aguievents.EventTypeToolCallChunk,
		aguievents.EventTypeToolCallResult,
		aguievents.EventTypeStateSnapshot,
		aguievents.EventTypeStateDelta,
		aguievents.EventTypeActivitySnapshot,
		aguievents.EventTypeActivityDelta,
		aguievents.EventTypeReasoningStart,
		aguievents.EventTypeReasoningMessageStart,
		aguievents.EventTypeReasoningMessageContent,
		aguievents.EventTypeReasoningMessageEnd,
		aguievents.EventTypeReasoningMessageChunk,
		aguievents.EventTypeReasoningEnd,
		aguievents.EventTypeReasoningEncryptedValue:
		return true
	default:
		return false
	}
}
