package agentprofiles

import (
	"context"
	"strings"

	"code-code.internal/go-contract/domainerror"
	agentprofilev1 "code-code.internal/go-contract/platform/agent_profile/v1"
)

func (s *Service) normalizeProfile(ctx context.Context, profile *agentprofilev1.AgentProfile) (*agentprofilev1.AgentProfile, error) {
	if profile == nil {
		return nil, validation("profile is nil")
	}
	name := strings.TrimSpace(profile.GetName())
	if name == "" {
		return nil, validation("profile name is required")
	}
	profileID, err := nextProfileID(profile)
	if err != nil {
		return nil, err
	}
	selection, err := s.normalizeSelectionStrategy(ctx, profile.GetSelectionStrategy())
	if err != nil {
		return nil, err
	}
	mcpIDs, err := s.normalizeReferenceIDs(ctx, selection.GetProviderId(), "mcp", profile.GetMcpIds())
	if err != nil {
		return nil, err
	}
	skillIDs, err := s.normalizeReferenceIDs(ctx, selection.GetProviderId(), "skill", profile.GetSkillIds())
	if err != nil {
		return nil, err
	}
	ruleIDs, err := s.normalizeReferenceIDs(ctx, selection.GetProviderId(), "rule", profile.GetRuleIds())
	if err != nil {
		return nil, err
	}
	return &agentprofilev1.AgentProfile{
		ProfileId:         profileID,
		Name:              name,
		SelectionStrategy: selection,
		McpIds:            mcpIDs,
		SkillIds:          skillIDs,
		RuleIds:           ruleIDs,
	}, nil
}

func (s *Service) normalizeSelectionStrategy(ctx context.Context, selection *agentprofilev1.AgentSelectionStrategy) (*agentprofilev1.AgentSelectionStrategy, error) {
	if selection == nil {
		return nil, validation("selection strategy is required")
	}
	providerID := strings.TrimSpace(selection.GetProviderId())
	if providerID == "" {
		return nil, validation("provider id is required")
	}
	if err := s.validateProviderID(ctx, providerID); err != nil {
		return nil, err
	}
	executionClass := strings.TrimSpace(selection.GetExecutionClass())
	if executionClass == "" {
		return nil, validation("execution class is required")
	}
	if err := s.ensureExecutionClassExists(ctx, providerID, executionClass); err != nil {
		return nil, err
	}
	fallbacks := make([]*agentprofilev1.AgentFallbackCandidate, 0, len(selection.GetFallbacks()))
	for i, item := range selection.GetFallbacks() {
		fallback, err := s.normalizeFallback(ctx, item, i)
		if err != nil {
			return nil, err
		}
		fallbacks = append(fallbacks, fallback)
	}
	if len(fallbacks) == 0 {
		return nil, validation("at least one fallback is required")
	}
	return &agentprofilev1.AgentSelectionStrategy{
		ProviderId:     providerID,
		ExecutionClass: executionClass,
		Fallbacks:      fallbacks,
	}, nil
}

func (s *Service) normalizeFallback(ctx context.Context, fallback *agentprofilev1.AgentFallbackCandidate, index int) (*agentprofilev1.AgentFallbackCandidate, error) {
	if fallback == nil {
		return nil, validationf("fallback %d is nil", index)
	}
	instanceID := strings.TrimSpace(fallback.GetProviderRuntimeRef().GetSurfaceId())
	if instanceID == "" {
		return nil, validationf("fallback %d provider surface binding id is required", index)
	}
	if err := s.providerReferences.SurfaceExists(ctx, instanceID); err != nil {
		return nil, err
	}
	modelRef := fallback.GetModelRef()
	providerModelID := strings.TrimSpace(fallback.GetProviderModelId())
	switch {
	case modelRef != nil:
		if strings.TrimSpace(modelRef.GetModelId()) == "" {
			return nil, validationf("fallback %d model ref model_id is required", index)
		}
	case providerModelID == "":
		return nil, validationf("fallback %d model selector is required", index)
	}
	out := &agentprofilev1.AgentFallbackCandidate{
		ProviderRuntimeRef: fallback.GetProviderRuntimeRef(),
	}
	if modelRef != nil {
		out.ModelSelector = &agentprofilev1.AgentFallbackCandidate_ModelRef{ModelRef: modelRef}
	} else {
		out.ModelSelector = &agentprofilev1.AgentFallbackCandidate_ProviderModelId{ProviderModelId: providerModelID}
	}
	return out, nil
}

func (s *Service) validateProviderID(ctx context.Context, providerID string) error {
	return s.providerReferences.ProviderExists(ctx, providerID)
}

func (s *Service) ensureExecutionClassExists(ctx context.Context, providerID, executionClass string) error {
	return s.providerReferences.ExecutionClassExists(ctx, providerID, executionClass)
}

func validation(message string) error {
	return domainerror.NewValidation("platformk8s/agentprofiles: %s", message)
}

func validationf(format string, args ...any) error {
	return domainerror.NewValidation("platformk8s/agentprofiles: "+format, args...)
}

func alreadyExists(profileID string) error {
	return domainerror.NewAlreadyExists("platformk8s/agentprofiles: profile %q already exists", profileID)
}
