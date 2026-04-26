package outputv1

import (
	"testing"

	"google.golang.org/protobuf/types/known/structpb"
	timestamppb "google.golang.org/protobuf/types/known/timestamppb"
)

func TestValidateRunOutputAcceptsAGUIEvent(t *testing.T) {
	t.Parallel()

	event, err := structpb.NewStruct(map[string]any{
		"type":      "TEXT_MESSAGE_CONTENT",
		"messageId": "message-1",
		"delta":     "hello",
	})
	if err != nil {
		t.Fatalf("NewStruct() error = %v", err)
	}
	output := &RunOutput{
		Sequence:  1,
		Timestamp: timestamppb.Now(),
		Event:     event,
	}

	if err := ValidateRunOutput(output); err != nil {
		t.Fatalf("ValidateRunOutput() error = %v", err)
	}
}

func TestValidateRunOutputRejectsEmptyEvent(t *testing.T) {
	t.Parallel()

	if err := ValidateRunOutput(&RunOutput{Sequence: 1}); err == nil {
		t.Fatal("ValidateRunOutput() expected error, got nil")
	}
}

func TestValidateRunOutputRejectsUnsafeSequence(t *testing.T) {
	t.Parallel()

	event, err := structpb.NewStruct(map[string]any{"type": "RUN_FINISHED"})
	if err != nil {
		t.Fatalf("NewStruct() error = %v", err)
	}
	output := &RunOutput{
		Sequence: maxSafeJSInteger + 1,
		Event:    event,
	}

	if err := ValidateRunOutput(output); err == nil {
		t.Fatal("ValidateRunOutput() expected error, got nil")
	}
}

func TestValidateRunOutputSequenceRejectsNonIncreasingSequence(t *testing.T) {
	t.Parallel()

	event, err := structpb.NewStruct(map[string]any{"type": "TEXT_MESSAGE_CONTENT"})
	if err != nil {
		t.Fatalf("NewStruct() error = %v", err)
	}
	outputs := []*RunOutput{
		{Sequence: 1, Event: event},
		{Sequence: 1, Event: event},
	}

	if err := ValidateRunOutputSequence(outputs); err == nil {
		t.Fatal("ValidateRunOutputSequence() expected error, got nil")
	}
}
