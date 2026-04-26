package agentprofiles

import "context"

type ProviderReferences interface {
	ProviderExists(ctx context.Context, providerID string) error
	ExecutionClassExists(ctx context.Context, providerID, executionClass string) error
	SurfaceExists(ctx context.Context, surfaceID string) error
	RuntimeCapabilitySupported(ctx context.Context, providerID, kind string) error
}

type ResourceReferences interface {
	MCPExists(ctx context.Context, mcpID string) error
	SkillExists(ctx context.Context, skillID string) error
	RuleExists(ctx context.Context, ruleID string) error
}
