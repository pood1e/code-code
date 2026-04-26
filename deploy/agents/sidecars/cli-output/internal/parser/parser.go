package parser

import (
	"time"

	outputv1 "code-code.internal/go-contract/agent/output/v1"
)

type Snapshot struct {
	LastSequence  uint64
	AssistantText string
	ReasoningText string
}

type Parser interface {
	ParseLine(line []byte, at time.Time) ([]*outputv1.RunOutput, error)
	Finalize(at time.Time) ([]*outputv1.RunOutput, error)
	Snapshot() Snapshot
}

type Factory func() Parser
