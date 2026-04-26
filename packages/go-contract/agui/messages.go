package agui

import (
	"encoding/json"
	"fmt"
	"strings"

	aguievents "github.com/ag-ui-protocol/ag-ui/sdks/community/go/pkg/core/events"
	aguitypes "github.com/ag-ui-protocol/ag-ui/sdks/community/go/pkg/core/types"
	"google.golang.org/protobuf/types/known/structpb"
)

func MessageFromRaw(raw json.RawMessage) (aguitypes.Message, error) {
	var message aguitypes.Message
	if err := json.Unmarshal(raw, &message); err != nil {
		return aguitypes.Message{}, err
	}
	return NormalizeMessage(message)
}

func MessageFromStruct(value *structpb.Struct) (aguitypes.Message, error) {
	if value == nil {
		return aguitypes.Message{}, fmt.Errorf("message is nil")
	}
	raw, err := StructJSON(value)
	if err != nil {
		return aguitypes.Message{}, err
	}
	return MessageFromRaw(raw)
}

func MessageRaw(message aguitypes.Message) (json.RawMessage, error) {
	normalized, err := NormalizeMessage(message)
	if err != nil {
		return nil, err
	}
	raw, err := json.Marshal(normalized)
	if err != nil {
		return nil, err
	}
	return raw, nil
}

func MessageStruct(message aguitypes.Message) (*structpb.Struct, error) {
	raw, err := MessageRaw(message)
	if err != nil {
		return nil, err
	}
	var payload map[string]any
	if err := json.Unmarshal(raw, &payload); err != nil {
		return nil, err
	}
	return structpb.NewStruct(payload)
}

func MessageStructFromRaw(raw json.RawMessage) (*structpb.Struct, error) {
	message, err := MessageFromRaw(raw)
	if err != nil {
		return nil, err
	}
	return MessageStruct(message)
}

func NormalizeMessage(message aguitypes.Message) (aguitypes.Message, error) {
	message.ID = strings.TrimSpace(message.ID)
	message.Role = aguitypes.Role(strings.TrimSpace(string(message.Role)))
	if err := aguievents.NewMessagesSnapshotEvent([]aguitypes.Message{message}).Validate(); err != nil {
		return aguitypes.Message{}, err
	}
	return message, nil
}

func TextMessage(id, role, text string) (aguitypes.Message, error) {
	return NormalizeMessage(aguitypes.Message{
		ID:      strings.TrimSpace(id),
		Role:    aguitypes.Role(strings.TrimSpace(role)),
		Content: text,
	})
}

func AssistantMessage(id, content string, toolCalls []aguitypes.ToolCall) (aguitypes.Message, error) {
	return NormalizeMessage(aguitypes.Message{
		ID:        strings.TrimSpace(id),
		Role:      aguitypes.RoleAssistant,
		Content:   content,
		ToolCalls: toolCalls,
	})
}

func ToolMessage(id, toolCallID, content string) (aguitypes.Message, error) {
	return NormalizeMessage(aguitypes.Message{
		ID:         strings.TrimSpace(id),
		Role:       aguitypes.RoleTool,
		Content:    content,
		ToolCallID: strings.TrimSpace(toolCallID),
	})
}

func LatestUserText(messages []aguitypes.Message) (string, error) {
	for index := len(messages) - 1; index >= 0; index-- {
		message := messages[index]
		if message.Role != aguitypes.RoleUser {
			continue
		}
		text := strings.TrimSpace(messageText(message))
		if text != "" {
			return text, nil
		}
	}
	return "", fmt.Errorf("user text message is required")
}

func messageText(message aguitypes.Message) string {
	if text, ok := message.ContentString(); ok {
		return text
	}
	parts, ok := message.ContentInputContents()
	if !ok {
		return ""
	}
	var builder strings.Builder
	for _, part := range parts {
		if part.Type == aguitypes.InputContentTypeText {
			builder.WriteString(part.Text)
		}
	}
	return builder.String()
}
