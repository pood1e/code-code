// Package agent defines the runtime behavior contract used by the platform to
// drive agent providers.
package agent

import (
	"context"

	capv1 "code-code.internal/go-contract/agent/cap/v1"
	corev1 "code-code.internal/go-contract/agent/core/v1"
	outputv1 "code-code.internal/go-contract/agent/output/v1"
	policyv1 "code-code.internal/go-contract/agent/policy/v1"
	resultv1 "code-code.internal/go-contract/agent/result/v1"
)

// AgentDescriptor describes an agent provider that can be selected by the platform.
type AgentDescriptor = corev1.AgentDescriptor

// RuntimeEnvironment describes the workload-local runtime roots provided by the
// platform.
type RuntimeEnvironment = corev1.RuntimeEnvironment

// RunRequest is the platform input for starting one run.
type RunRequest = corev1.RunRequest

// ProviderFilter constrains which external LLM providers an agent can use.
type ProviderFilter = policyv1.ProviderFilter

// AgentResources is the capability resource snapshot applied before a run starts.
type AgentResources = capv1.AgentResources

// RunOutput is one ordered output item emitted by a run.
type RunOutput = outputv1.RunOutput

// RunError describes one structured run error.
type RunError = resultv1.RunError

// RunResult is the final outcome of one run.
type RunResult = resultv1.RunResult

// RunEvent describes one item emitted by the run output stream.
type RunEvent struct {
	Output *RunOutput
	Error  *RunError
}

// AgentProvider is the entry point implemented by an agent provider.
type AgentProvider interface {
	// Descriptor returns the provider metadata and supported capabilities.
	Descriptor() *AgentDescriptor

	// NewRuntime creates a runtime bound to the supplied workload-local environment.
	NewRuntime(env *RuntimeEnvironment) (AgentRuntime, error)
}

// AgentRuntime is the platform-driven runtime for one provider environment.
type AgentRuntime interface {
	// ApplyResources applies the latest capability resource snapshot for future runs.
	ApplyResources(ctx context.Context, resources *AgentResources) error

	// HealthCheck reports whether the runtime is still healthy enough to accept work.
	HealthCheck(ctx context.Context) error

	// StartRun starts one run and returns its lifecycle handle.
	StartRun(ctx context.Context, request *RunRequest) (Run, error)

	// Close releases runtime-owned resources.
	Close(ctx context.Context) error
}

// Run is the lifecycle handle for one running agent turn.
type Run interface {
	// Outputs returns the ordered output stream for the run. Stream errors are
	// emitted as terminal RunEvent values with Error set.
	Outputs() <-chan *RunEvent

	// Wait waits for the run to finish and returns its final result.
	Wait(ctx context.Context) (*RunResult, error)

	// Stop requests cancellation of the run.
	Stop(ctx context.Context) error
}
