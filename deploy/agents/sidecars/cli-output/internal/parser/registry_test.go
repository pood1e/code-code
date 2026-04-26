package parser

import (
	"testing"
	"time"

	outputv1 "code-code.internal/go-contract/agent/output/v1"
)

type stubParser struct{}

func (stubParser) ParseLine([]byte, time.Time) ([]*outputv1.RunOutput, error) { return nil, nil }
func (stubParser) Finalize(time.Time) ([]*outputv1.RunOutput, error)          { return nil, nil }
func (stubParser) Snapshot() Snapshot                                         { return Snapshot{} }

func TestRegistryRejectsDuplicateAndUnknownCLI(t *testing.T) {
	registry := NewRegistry()
	factory := func() Parser { return stubParser{} }

	if err := registry.Register("claude-code", factory); err != nil {
		t.Fatalf("Register() error = %v", err)
	}
	if err := registry.Register("claude-code", factory); err == nil {
		t.Fatal("Register() expected duplicate error, got nil")
	}
	if _, err := registry.New("missing"); err == nil {
		t.Fatal("New() expected missing cli error, got nil")
	}
}
