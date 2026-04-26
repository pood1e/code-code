package codex

import (
	"time"

	"code-code.internal/cli-output-sidecar/internal/parser"
	outputv1 "code-code.internal/go-contract/agent/output/v1"
)

type codexEvent struct {
	Type    string      `json:"type"`
	Usage   *codexUsage `json:"usage,omitempty"`
	Error   *codexError `json:"error,omitempty"`
	Message string      `json:"message,omitempty"`
	Item    *codexItem  `json:"item,omitempty"`
}

type codexUsage struct {
	InputTokens       int64 `json:"input_tokens"`
	CachedInputTokens int64 `json:"cached_input_tokens"`
	OutputTokens      int64 `json:"output_tokens"`
	RequestCount      int64 `json:"request_count"`
	ToolCallCount     int64 `json:"tool_call_count"`
}

type codexError struct {
	Message string `json:"message"`
}

type codexItem struct {
	ID               string            `json:"id"`
	Type             string            `json:"type"`
	Text             string            `json:"text,omitempty"`
	Command          string            `json:"command,omitempty"`
	AggregatedOutput string            `json:"aggregated_output,omitempty"`
	Status           string            `json:"status,omitempty"`
	Changes          []codexFileChange `json:"changes,omitempty"`
	Server           string            `json:"server,omitempty"`
	Tool             string            `json:"tool,omitempty"`
	Arguments        any               `json:"arguments,omitempty"`
	Result           any               `json:"result,omitempty"`
	Query            string            `json:"query,omitempty"`
}

type codexFileChange struct {
	Path string `json:"path"`
	Kind string `json:"kind"`
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
	var event codexEvent
	if !parser.DecodeJSONLine(line, &event) {
		return nil, nil
	}
	switch event.Type {
	case "item.started", "item.updated", "item.completed":
		return p.parseItem(event.Item, at), nil
	case "turn.completed":
		return p.turnCompleted(event.Usage, at), nil
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

func (p *Parser) parseItem(item *codexItem, at time.Time) []*outputv1.RunOutput {
	if item == nil {
		return nil
	}
	switch item.Type {
	case "agent_message":
		return p.builder.SyncAssistant(item.Text, at)
	case "reasoning":
		return p.builder.SyncReasoning(item.Text, at)
	case "command_execution":
		return p.builder.ToolCall("bash", item.ID, firstNonEmpty(item.Command, item.AggregatedOutput), at)
	case "file_change":
		return p.builder.ToolCall("apply_patch", item.ID, firstNonEmpty(changeSummary(item.Changes), item.Status), at)
	case "mcp_tool_call":
		return p.builder.ToolCall(mcpToolName(item), item.ID, firstNonEmpty(parser.Summary(item.Result), parser.Summary(item.Arguments)), at)
	case "web_search":
		return p.builder.ToolCall("web_search", item.ID, item.Query, at)
	default:
		return nil
	}
}

func (p *Parser) turnCompleted(usage *codexUsage, at time.Time) []*outputv1.RunOutput {
	outputs := make([]*outputv1.RunOutput, 0, 3)
	if usage != nil {
		outputs = append(outputs, p.builder.TurnUsage(parser.TurnUsage(
			usage.InputTokens,
			usage.OutputTokens,
			usage.CachedInputTokens,
			0,
			usage.RequestCount,
			usage.ToolCallCount,
		), at))
	}
	outputs = append(outputs, p.finalizer.Finalize(at)...)
	return compact(outputs)
}

func changeSummary(changes []codexFileChange) string {
	if len(changes) == 0 {
		return ""
	}
	summary := ""
	for i, change := range changes {
		if i > 0 {
			summary += ", "
		}
		summary += firstNonEmpty(change.Kind, "change") + ":" + change.Path
	}
	return summary
}

func mcpToolName(item *codexItem) string {
	if item == nil {
		return ""
	}
	if item.Server != "" && item.Tool != "" {
		return item.Server + "/" + item.Tool
	}
	return firstNonEmpty(item.Tool, item.Server)
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
