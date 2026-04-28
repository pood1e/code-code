package agentprofiles

import (
	"context"
	"fmt"
	"strings"
)

func (s *Service) normalizeReferenceIDs(ctx context.Context, providerID, kind string, ids []string) ([]string, error) {
	if len(ids) == 0 {
		return nil, nil
	}
	if err := s.ensureReferenceKindSupported(ctx, providerID, kind); err != nil {
		return nil, err
	}
	seen := make(map[string]struct{}, len(ids))
	out := make([]string, 0, len(ids))
	for _, value := range ids {
		id := strings.TrimSpace(value)
		if id == "" {
			return nil, validationf("%s id is empty", kind)
		}
		if _, exists := seen[id]; exists {
			return nil, validationf("duplicate %s id %q", kind, id)
		}
		if err := s.ensureReferenceExists(ctx, kind, id); err != nil {
			return nil, err
		}
		seen[id] = struct{}{}
		out = append(out, id)
	}
	return out, nil
}

func (s *Service) ensureReferenceKindSupported(ctx context.Context, providerID, kind string) error {
	return s.providerReferences.RuntimeCapabilitySupported(ctx, providerID, kind)
}

func (s *Service) ensureReferenceExists(ctx context.Context, kind, id string) error {
	switch kind {
	case "mcp":
		return s.resourceReferences.MCPExists(ctx, id)
	case "skill":
		return s.resourceReferences.SkillExists(ctx, id)
	case "rule":
		return s.resourceReferences.RuleExists(ctx, id)
	default:
		return fmt.Errorf("platformk8s/agentprofiles: unsupported reference kind %q", kind)
	}
}
