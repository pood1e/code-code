package gemini

import (
	"time"

	"code-code.internal/cli-output-sidecar/internal/parser"
	outputv1 "code-code.internal/go-contract/agent/output/v1"
)

type event struct {
	Type       string `json:"type"`
	Role       string `json:"role,omitempty"`
	Content    string `json:"content,omitempty"`
	Delta      bool   `json:"delta,omitempty"`
	ToolName   string `json:"tool_name,omitempty"`
	ToolID     string `json:"tool_id,omitempty"`
	Output     string `json:"output,omitempty"`
	Severity   string `json:"severity,omitempty"`
	Message    string `json:"message,omitempty"`
	Parameters any    `json:"parameters,omitempty"`
	Stats      *stats `json:"stats,omitempty"`
}

type stats struct {
	InputTokenCount  int64 `json:"input_token_count,omitempty"`
	OutputTokenCount int64 `json:"output_token_count,omitempty"`
}

type Parser struct {
	builder   *parser.Builder
	finalizer *parser.Finalizer
}

func New() parser.Parser {
	builder := parser.NewBuilder()
	return &Parser{builder: builder, finalizer: parser.NewFinalizer(builder)}
}

func (p *Parser) ParseLine(line []byte, at time.Time) ([]*outputv1.RunOutput, error) {
	var payload event
	if !parser.DecodeJSONLine(line, &payload) {
		return nil, nil
	}
	switch payload.Type {
	case "message":
		if payload.Role != "assistant" {
			return nil, nil
		}
		if payload.Delta {
			return p.builder.AppendAssistant(payload.Content, at), nil
		}
		return p.builder.SyncAssistant(payload.Content, at), nil
	case "tool_use":
		return p.builder.ToolCall(payload.ToolName, payload.ToolID, parser.Summary(payload.Parameters), at), nil
	case "tool_result":
		return p.builder.ToolCall(firstNonEmpty(payload.ToolName, "tool_result"), payload.ToolID, firstNonEmpty(payload.Output, payload.Message), at), nil
	case "result":
		return p.complete(payload.Stats, at), nil
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

func (p *Parser) complete(stats *stats, at time.Time) []*outputv1.RunOutput {
	outputs := make([]*outputv1.RunOutput, 0, 2)
	if stats != nil {
		outputs = append(outputs, p.builder.TurnUsage(parser.TurnUsage(
			stats.InputTokenCount,
			stats.OutputTokenCount,
			0,
			0,
			0,
			0,
		), at))
	}
	outputs = append(outputs, p.finalizer.Finalize(at)...)
	return compact(outputs)
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if value != "" {
			return value
		}
	}
	return ""
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
