package parsers

import (
	"code-code.internal/cli-output-sidecar/internal/parser"
	"code-code.internal/cli-output-sidecar/internal/parsers/claude"
	"code-code.internal/cli-output-sidecar/internal/parsers/codex"
	"code-code.internal/cli-output-sidecar/internal/parsers/gemini"
	"code-code.internal/cli-output-sidecar/internal/parsers/qwen"
)

func NewBuiltinRegistry() (*parser.Registry, error) {
	registry := parser.NewRegistry()
	for cliID, factory := range map[string]parser.Factory{
		"claude-code": claude.New,
		"codex":       codex.New,
		"gemini-cli":  gemini.New,
		"qwen-cli":    qwen.New,
	} {
		if err := registry.Register(cliID, factory); err != nil {
			return nil, err
		}
	}
	return registry, nil
}
