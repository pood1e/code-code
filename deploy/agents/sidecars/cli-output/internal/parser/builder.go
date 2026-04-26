package parser

import (
	"fmt"
	"strings"
	"time"

	outputv1 "code-code.internal/go-contract/agent/output/v1"
	"code-code.internal/go-contract/agui"
	aguievents "github.com/ag-ui-protocol/ag-ui/sdks/community/go/pkg/core/events"
	aguitypes "github.com/ag-ui-protocol/ag-ui/sdks/community/go/pkg/core/types"
	"google.golang.org/protobuf/types/known/structpb"
)

type Builder struct {
	sequence           uint64
	toolSequence       uint64
	assistantText      textAccumulator
	reasoningText      textAccumulator
	assistantOpen      bool
	reasoningOpen      bool
	reasoningPhaseOpen bool
}

type textAccumulator struct {
	segments []string
	text     string
	dirty    bool
}

func (a *textAccumulator) Append(text string) {
	if text == "" {
		return
	}
	a.segments = append(a.segments, text)
	a.dirty = true
}

func (a *textAccumulator) Set(text string) {
	a.text = text
	a.segments = nil
	a.dirty = false
}

func (a *textAccumulator) String() string {
	if a == nil {
		return ""
	}
	if a.dirty {
		a.text += strings.Join(a.segments, "")
		a.segments = nil
		a.dirty = false
	}
	return a.text
}

func (a *textAccumulator) Empty() bool {
	return a == nil || a.String() == ""
}

type UsagePayload map[string]any

func NewBuilder() *Builder {
	return &Builder{}
}

func (b *Builder) Snapshot() Snapshot {
	return Snapshot{
		LastSequence:  b.sequence,
		AssistantText: b.assistantText.String(),
		ReasoningText: b.reasoningText.String(),
	}
}

func (b *Builder) AppendAssistant(text string, at time.Time) []*outputv1.RunOutput {
	if text == "" {
		return nil
	}
	b.assistantText.Append(text)
	return b.appendText(at, &b.assistantOpen, textChannelAssistant, "assistant-message", string(aguitypes.RoleAssistant), text)
}

func (b *Builder) SyncAssistant(text string, at time.Time) []*outputv1.RunOutput {
	return b.syncText(text, b.assistantText.String(), at, func(next string) { b.assistantText.Set(next) }, &b.assistantOpen, textChannelAssistant, "assistant-message", string(aguitypes.RoleAssistant), false)
}

func (b *Builder) AppendReasoning(text string, at time.Time) []*outputv1.RunOutput {
	if text == "" {
		return nil
	}
	b.reasoningText.Append(text)
	return b.appendText(at, &b.reasoningOpen, textChannelReasoning, "reasoning-message", string(aguitypes.RoleReasoning), text)
}

func (b *Builder) SyncReasoning(text string, at time.Time) []*outputv1.RunOutput {
	return b.syncText(text, b.reasoningText.String(), at, func(next string) { b.reasoningText.Set(next) }, &b.reasoningOpen, textChannelReasoning, "reasoning-message", string(aguitypes.RoleReasoning), false)
}

func (b *Builder) LLMUsage(payload UsagePayload, at time.Time) *outputv1.RunOutput {
	return b.usage(agui.CustomRunLLMUsage, payload, at)
}

func (b *Builder) TurnUsage(payload UsagePayload, at time.Time) *outputv1.RunOutput {
	return b.usage(agui.CustomRunTurnUsage, payload, at)
}

func (b *Builder) ResultAssistant(text string, at time.Time) []*outputv1.RunOutput {
	if text != "" {
		return b.syncText(text, b.assistantText.String(), at, func(next string) { b.assistantText.Set(next) }, &b.assistantOpen, textChannelAssistant, "assistant-message", string(aguitypes.RoleAssistant), true)
	}
	if b.assistantText.Empty() || !b.assistantOpen {
		return nil
	}
	b.assistantOpen = false
	return []*outputv1.RunOutput{b.nextOutput(at, aguievents.NewTextMessageEndEvent("assistant-message"))}
}

func (b *Builder) ResultReasoning(text string, at time.Time) []*outputv1.RunOutput {
	if text != "" {
		return b.syncText(text, b.reasoningText.String(), at, func(next string) { b.reasoningText.Set(next) }, &b.reasoningOpen, textChannelReasoning, "reasoning-message", string(aguitypes.RoleReasoning), true)
	}
	if b.reasoningText.Empty() || !b.reasoningOpen {
		return nil
	}
	return b.closeTextIfOpen(at, &b.reasoningOpen, textChannelReasoning, "reasoning-message")
}

func (b *Builder) syncText(text, current string, at time.Time, assign func(string), open *bool, channel textChannel, messageID, role string, close bool) []*outputv1.RunOutput {
	if text == "" || text == current {
		if close {
			return b.closeTextIfOpen(at, open, channel, messageID)
		}
		return nil
	}
	assign(text)
	if strings.HasPrefix(text, current) {
		outputs := b.appendText(at, open, channel, messageID, role, text[len(current):])
		if close {
			outputs = append(outputs, b.closeTextIfOpen(at, open, channel, messageID)...)
		}
		return outputs
	}
	outputs := b.closeTextIfOpen(at, open, channel, messageID)
	outputs = append(outputs, b.appendText(at, open, channel, messageID, role, text)...)
	if close {
		outputs = append(outputs, b.closeTextIfOpen(at, open, channel, messageID)...)
	}
	return outputs
}

func (b *Builder) appendText(at time.Time, open *bool, channel textChannel, messageID, role, text string) []*outputv1.RunOutput {
	outputs := make([]*outputv1.RunOutput, 0, 3)
	if !*open {
		*open = true
		if channel == textChannelReasoning && !b.reasoningPhaseOpen {
			b.reasoningPhaseOpen = true
			outputs = append(outputs, b.nextOutput(at, aguievents.NewReasoningStartEvent(messageID)))
		}
		outputs = append(outputs, b.nextOutput(at, startTextEvent(channel, messageID, role)))
	}
	if text != "" {
		outputs = append(outputs, b.nextOutput(at, contentTextEvent(channel, messageID, text)))
	}
	return outputs
}

func (b *Builder) closeTextIfOpen(at time.Time, open *bool, channel textChannel, messageID string) []*outputv1.RunOutput {
	if !*open {
		return nil
	}
	*open = false
	outputs := []*outputv1.RunOutput{b.nextOutput(at, endTextEvent(channel, messageID))}
	if channel == textChannelReasoning && b.reasoningPhaseOpen {
		b.reasoningPhaseOpen = false
		outputs = append(outputs, b.nextOutput(at, aguievents.NewReasoningEndEvent(messageID)))
	}
	return outputs
}

func (b *Builder) usage(name string, payload UsagePayload, at time.Time) *outputv1.RunOutput {
	if len(payload) == 0 {
		return nil
	}
	return b.nextOutput(at, aguievents.NewCustomEvent(name, aguievents.WithValue(map[string]any(payload))))
}

func (b *Builder) nextOutput(at time.Time, event aguievents.Event) *outputv1.RunOutput {
	b.sequence++
	output, err := agui.RunOutput(b.sequence, at, event)
	if err != nil {
		payload, _ := structpb.NewStruct(map[string]any{
			"type":  string(aguievents.EventTypeCustom),
			"name":  agui.CustomRunOutputInvalid,
			"value": fmt.Sprint(err),
		})
		return &outputv1.RunOutput{
			Sequence: b.sequence,
			Event:    payload,
		}
	}
	return output
}
