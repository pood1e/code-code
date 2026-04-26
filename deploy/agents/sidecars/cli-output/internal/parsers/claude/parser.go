package claude

import (
	"time"

	"code-code.internal/cli-output-sidecar/internal/parser"
	outputv1 "code-code.internal/go-contract/agent/output/v1"
)

type Parser struct {
	builder      *parser.Builder
	finalizer    *parser.Finalizer
	usageEmitted bool
}

func New() parser.Parser {
	builder := parser.NewBuilder()
	return &Parser{builder: builder, finalizer: parser.NewFinalizer(builder)}
}

func (p *Parser) ParseLine(line []byte, at time.Time) ([]*outputv1.RunOutput, error) {
	var payload map[string]any
	if !parser.DecodeJSONLine(line, &payload) {
		return nil, nil
	}
	switch parser.StringValue(payload, "type") {
	case "stream_event", "content_block_delta", "content_block_start":
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
	if event == nil {
		event = payload
	}
	switch parser.StringValue(event, "type") {
	case "content_block_delta":
		delta := parser.MapValue(event, "delta")
		switch parser.StringValue(delta, "type") {
		case "thinking_delta", "signature_delta":
			return p.builder.AppendReasoning(parser.StringValue(delta, "thinking"), at)
		case "text_delta":
			return p.builder.AppendAssistant(parser.StringValue(delta, "text"), at)
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
	if message == nil {
		message = payload
	}
	outputs := make([]*outputv1.RunOutput, 0, 4)
	for _, item := range parser.SliceValue(message, "content") {
		block, _ := item.(map[string]any)
		switch parser.StringValue(block, "type") {
		case "text":
			outputs = append(outputs, p.builder.SyncAssistant(parser.StringValue(block, "text"), at)...)
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
	outputs := make([]*outputv1.RunOutput, 0, 3)
	outputs = append(outputs, p.finalizer.EmitReasoning("", at)...)
	outputs = append(outputs, p.finalizer.EmitAssistant(parser.StringValue(payload, "result"), at)...)
	outputs = append(outputs, p.turnUsage(parser.MapValue(payload, "usage"), at)...)
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
		parser.Int64Value(usage["reasoning_output_tokens"]),
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
