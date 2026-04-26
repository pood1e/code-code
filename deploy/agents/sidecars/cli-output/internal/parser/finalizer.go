package parser

import (
	"time"

	outputv1 "code-code.internal/go-contract/agent/output/v1"
)

type Finalizer struct {
	builder          *Builder
	assistantEmitted bool
	reasoningEmitted bool
}

func NewFinalizer(builder *Builder) *Finalizer {
	return &Finalizer{builder: builder}
}

func (f *Finalizer) EmitAssistant(text string, at time.Time) []*outputv1.RunOutput {
	if f.assistantEmitted {
		return nil
	}
	outputs := f.builder.ResultAssistant(text, at)
	if len(outputs) == 0 {
		return nil
	}
	f.assistantEmitted = true
	return outputs
}

func (f *Finalizer) EmitReasoning(text string, at time.Time) []*outputv1.RunOutput {
	if f.reasoningEmitted {
		return nil
	}
	outputs := f.builder.ResultReasoning(text, at)
	if len(outputs) == 0 {
		return nil
	}
	f.reasoningEmitted = true
	return outputs
}

func (f *Finalizer) Finalize(at time.Time) []*outputv1.RunOutput {
	outputs := make([]*outputv1.RunOutput, 0, 2)
	outputs = append(outputs, f.EmitReasoning("", at)...)
	outputs = append(outputs, f.EmitAssistant("", at)...)
	return outputs
}
