package profileservice

import (
	"context"

	"code-code.internal/platform-k8s/mcpservers"
	"code-code.internal/platform-k8s/rules"
	"code-code.internal/platform-k8s/skills"
)

type resourceReferences struct {
	mcps   mcpservers.Store
	skills skills.Store
	rules  rules.Store
}

func (r resourceReferences) MCPExists(ctx context.Context, mcpID string) error {
	_, err := r.mcps.Load(ctx, mcpID)
	return err
}

func (r resourceReferences) SkillExists(ctx context.Context, skillID string) error {
	_, err := r.skills.Load(ctx, skillID)
	return err
}

func (r resourceReferences) RuleExists(ctx context.Context, ruleID string) error {
	_, err := r.rules.Load(ctx, ruleID)
	return err
}
