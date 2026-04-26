package qwen

import (
	"time"

	"code-code.internal/cli-output-sidecar/internal/parser"
	outputv1 "code-code.internal/go-contract/agent/output/v1"
)

type Parser struct {
	builder      *parser.Builder
	finalizer    *parser.Finalizer
	inlineThink  *inlineThinkingStream
	usageEmitted bool
}

func New() parser.Parser {
	builder := parser.NewBuilder()
	return &Parser{
		builder:     builder,
		finalizer:   parser.NewFinalizer(builder),
		inlineThink: &inlineThinkingStream{},
	}
}

func (p *Parser) ParseLine(line []byte, at time.Time) ([]*outputv1.RunOutput, error) {
	var payload map[string]any
	if !parser.DecodeJSONLine(line, &payload) {
		return nil, nil
	}
	switch parser.StringValue(payload, "type") {
	case "stream_event":
		return p.parseEvent(payload, at), nil
	case "assistant":
		return p.parseAssistant(payload, at), nil
	case "result":
		return p.parseResult(payload, at), nil
	default:
		return nil, nil
	}
}

func (p *Parser) Finalize(at time.Time) ([]*outputv1.RunOutput, error) {
	return p.finalizer.Finalize(at), nil
}

func (p *Parser) Snapshot() parser.Snapshot {
	return p.builder.Snapshot()
}

func (p *Parser) parseEvent(payload map[string]any, at time.Time) []*outputv1.RunOutput {
	event := parser.MapValue(payload, "event")
	switch parser.StringValue(event, "type") {
	case "content_block_delta":
		delta := parser.MapValue(event, "delta")
		switch parser.StringValue(delta, "type") {
		case "thinking_delta":
			return p.builder.AppendReasoning(parser.StringValue(delta, "thinking"), at)
		case "text_delta":
			return p.appendInlineText(parser.StringValue(delta, "text"), at)
		}
	case "content_block_start":
		block := parser.MapValue(event, "content_block")
		if parser.StringValue(block, "type") != "tool_use" {
			return nil
		}
		return p.builder.ToolCall(parser.StringValue(block, "name"), parser.StringValue(block, "id"), parser.Summary(block["input"]), at)
	}
	return nil
}

func (p *Parser) parseAssistant(payload map[string]any, at time.Time) []*outputv1.RunOutput {
	message := parser.MapValue(payload, "message")
	outputs := make([]*outputv1.RunOutput, 0, 4)
	for _, item := range parser.SliceValue(message, "content") {
		block, _ := item.(map[string]any)
		switch parser.StringValue(block, "type") {
		case "text":
			outputs = append(outputs, p.syncInlineText(parser.StringValue(block, "text"), at)...)
		case "tool_use":
			outputs = append(outputs, p.builder.ToolCall(parser.StringValue(block, "name"), parser.StringValue(block, "id"), parser.Summary(block["input"]), at)...)
		}
	}
	outputs = append(outputs, p.turnUsage(parser.MapValue(message, "usage"), at)...)
	return compact(outputs)
}

func (p *Parser) parseResult(payload map[string]any, at time.Time) []*outputv1.RunOutput {
	if parser.BoolValue(payload, "is_error") {
		return nil
	}
	reasoning, assistant := splitInlineThinking(parser.StringValue(payload, "result"))
	outputs := make([]*outputv1.RunOutput, 0, 3)
	outputs = append(outputs, p.finalizer.EmitReasoning(reasoning, at)...)
	outputs = append(outputs, p.finalizer.EmitAssistant(assistant, at)...)
	outputs = append(outputs, p.turnUsage(parser.MapValue(payload, "usage"), at)...)
	return compact(outputs)
}

func (p *Parser) appendInlineText(text string, at time.Time) []*outputv1.RunOutput {
	if p == nil || text == "" {
		return nil
	}
	reasoning, assistant := p.inlineThink.Append(text)
	outputs := make([]*outputv1.RunOutput, 0, 2)
	outputs = append(outputs, p.builder.AppendReasoning(reasoning, at)...)
	outputs = append(outputs, p.builder.AppendAssistant(assistant, at)...)
	return compact(outputs)
}

func (p *Parser) syncInlineText(text string, at time.Time) []*outputv1.RunOutput {
	if p == nil || text == "" {
		return nil
	}
	reasoning, assistant := splitInlineThinking(text)
	outputs := make([]*outputv1.RunOutput, 0, 2)
	if reasoning != "" {
		outputs = append(outputs, p.builder.SyncReasoning(reasoning, at)...)
	}
	outputs = append(outputs, p.builder.SyncAssistant(assistant, at)...)
	return compact(outputs)
}

func (p *Parser) turnUsage(usage map[string]any, at time.Time) []*outputv1.RunOutput {
	if p.usageEmitted || usage == nil {
		return nil
	}
	output := p.builder.TurnUsage(parser.TurnUsage(
		parser.Int64Value(usage["input_tokens"]),
		parser.Int64Value(usage["output_tokens"]),
		parser.Int64Value(usage["cache_read_input_tokens"]),
		0,
		0,
		0,
	), at)
	if output == nil {
		return nil
	}
	p.usageEmitted = true
	return []*outputv1.RunOutput{output}
}

func compact(outputs []*outputv1.RunOutput) []*outputv1.RunOutput {
	filtered := outputs[:0]
	for _, output := range outputs {
		if output != nil {
			filtered = append(filtered, output)
		}
	}
	return filtered
}
