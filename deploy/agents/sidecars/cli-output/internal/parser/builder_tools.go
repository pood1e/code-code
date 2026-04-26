package parser

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	outputv1 "code-code.internal/go-contract/agent/output/v1"
	aguievents "github.com/ag-ui-protocol/ag-ui/sdks/community/go/pkg/core/events"
)

func (b *Builder) ToolCall(name, callID, summary string, at time.Time) []*outputv1.RunOutput {
	name = strings.TrimSpace(name)
	if name == "" {
		return nil
	}
	callID = strings.TrimSpace(callID)
	if callID == "" {
		b.toolSequence++
		callID = fmt.Sprintf("tool-%d", b.toolSequence)
	}
	summary = strings.TrimSpace(summary)
	if summary == "" {
		summary = name
	}
	arguments := toolCallArguments(summary)
	return []*outputv1.RunOutput{
		b.nextOutput(at, aguievents.NewToolCallStartEvent(callID, name, aguievents.WithParentMessageID("assistant-message"))),
		b.nextOutput(at, aguievents.NewToolCallArgsEvent(callID, arguments)),
		b.nextOutput(at, aguievents.NewToolCallEndEvent(callID)),
		b.nextOutput(at, aguievents.NewToolCallResultEvent("tool-message-"+callID, callID, toolCallResult(summary))),
	}
}

func toolCallArguments(summary string) string {
	body, _ := json.Marshal(map[string]string{"summary": summary})
	return string(body)
}

func toolCallResult(summary string) string {
	return toolCallArguments(summary)
}
