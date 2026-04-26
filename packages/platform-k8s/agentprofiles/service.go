package agentprofiles

import (
	"context"
	"fmt"
	"slices"
	"strings"

	agentprofilev1 "code-code.internal/go-contract/platform/agent_profile/v1"
	managementv1 "code-code.internal/go-contract/platform/management/v1"
	"code-code.internal/platform-k8s/internal/resourcemeta"
	"google.golang.org/protobuf/proto"
)

type Service struct {
	store              ProfileStore
	providerReferences ProviderReferences
	resourceReferences ResourceReferences
}

type ProfileState struct {
	Profile    *agentprofilev1.AgentProfile
	Generation int64
}

type Config struct {
	Store              ProfileStore
	ProviderReferences ProviderReferences
	ResourceReferences ResourceReferences
}

func NewService(config Config) (*Service, error) {
	if config.Store == nil {
		return nil, fmt.Errorf("platformk8s/agentprofiles: store is nil")
	}
	if config.ProviderReferences == nil {
		return nil, fmt.Errorf("platformk8s/agentprofiles: provider references is nil")
	}
	if config.ResourceReferences == nil {
		return nil, fmt.Errorf("platformk8s/agentprofiles: resource references is nil")
	}
	return &Service{
		store:              config.Store,
		providerReferences: config.ProviderReferences,
		resourceReferences: config.ResourceReferences,
	}, nil
}

func (s *Service) List(ctx context.Context) ([]*managementv1.AgentProfileListItem, error) {
	states, err := s.store.List(ctx)
	if err != nil {
		return nil, err
	}
	items := make([]*managementv1.AgentProfileListItem, 0, len(states))
	for _, state := range states {
		if state == nil || state.Profile == nil {
			continue
		}
		profile := state.Profile
		items = append(items, &managementv1.AgentProfileListItem{
			ProfileId:        profile.GetProfileId(),
			Name:             profile.GetName(),
			ProviderId:       profile.GetSelectionStrategy().GetProviderId(),
			SelectionSummary: selectionSummary(profile),
			McpCount:         int32(len(profile.GetMcpIds())),
			SkillCount:       int32(len(profile.GetSkillIds())),
			RuleCount:        int32(len(profile.GetRuleIds())),
		})
	}
	slices.SortFunc(items, func(a, b *managementv1.AgentProfileListItem) int {
		if a.GetName() != b.GetName() {
			return strings.Compare(a.GetName(), b.GetName())
		}
		return strings.Compare(a.GetProfileId(), b.GetProfileId())
	})
	return items, nil
}

func (s *Service) Get(ctx context.Context, profileID string) (*agentprofilev1.AgentProfile, error) {
	state, err := s.GetState(ctx, profileID)
	if err != nil {
		return nil, err
	}
	return state.Profile, nil
}

func (s *Service) GetState(ctx context.Context, profileID string) (*ProfileState, error) {
	return s.store.Get(ctx, profileID)
}

func (s *Service) Create(ctx context.Context, profile *agentprofilev1.AgentProfile) (*agentprofilev1.AgentProfile, error) {
	next, err := s.normalizeProfile(ctx, profile)
	if err != nil {
		return nil, err
	}
	state, err := s.store.Create(ctx, next)
	if err != nil {
		return nil, err
	}
	return state.Profile, nil
}

func (s *Service) Update(ctx context.Context, profileID string, profile *agentprofilev1.AgentProfile) (*agentprofilev1.AgentProfile, error) {
	next, err := s.normalizeProfile(ctx, profileWithID(profile, profileID))
	if err != nil {
		return nil, err
	}
	state, err := s.store.Update(ctx, next.GetProfileId(), next)
	if err != nil {
		return nil, err
	}
	return state.Profile, nil
}

func (s *Service) Delete(ctx context.Context, profileID string) error {
	return s.store.Delete(ctx, profileID)
}

func (s *Service) DetachMCP(ctx context.Context, mcpID string) error {
	return s.detachProfileReference(ctx, "mcp", mcpID, func(profile *agentprofilev1.AgentProfile, id string) bool {
		next, changed := withoutReferenceID(profile.GetMcpIds(), id)
		profile.McpIds = next
		return changed
	})
}

func (s *Service) DetachSkill(ctx context.Context, skillID string) error {
	return s.detachProfileReference(ctx, "skill", skillID, func(profile *agentprofilev1.AgentProfile, id string) bool {
		next, changed := withoutReferenceID(profile.GetSkillIds(), id)
		profile.SkillIds = next
		return changed
	})
}

func (s *Service) DetachRule(ctx context.Context, ruleID string) error {
	return s.detachProfileReference(ctx, "rule", ruleID, func(profile *agentprofilev1.AgentProfile, id string) bool {
		next, changed := withoutReferenceID(profile.GetRuleIds(), id)
		profile.RuleIds = next
		return changed
	})
}

func (s *Service) detachProfileReference(ctx context.Context, kind, id string, detach func(*agentprofilev1.AgentProfile, string) bool) error {
	id = strings.TrimSpace(id)
	if id == "" {
		return validationf("%s id is empty", kind)
	}
	states, err := s.store.List(ctx)
	if err != nil {
		return err
	}
	for _, state := range states {
		if state == nil || state.Profile == nil {
			continue
		}
		next := proto.Clone(state.Profile).(*agentprofilev1.AgentProfile)
		if !detach(next, id) {
			continue
		}
		if _, err := s.store.Update(ctx, next.GetProfileId(), next); err != nil {
			return err
		}
	}
	return nil
}

func withoutReferenceID(ids []string, id string) ([]string, bool) {
	next := make([]string, 0, len(ids))
	changed := false
	for _, item := range ids {
		if strings.TrimSpace(item) == id {
			changed = true
			continue
		}
		next = append(next, item)
	}
	return next, changed
}

func profileWithID(profile *agentprofilev1.AgentProfile, profileID string) *agentprofilev1.AgentProfile {
	next := &agentprofilev1.AgentProfile{}
	if profile != nil {
		next = proto.Clone(profile).(*agentprofilev1.AgentProfile)
	}
	next.ProfileId = strings.TrimSpace(profileID)
	return next
}

func nextProfileID(profile *agentprofilev1.AgentProfile) (string, error) {
	return resourcemeta.EnsureResourceID(strings.TrimSpace(profile.GetProfileId()), strings.TrimSpace(profile.GetName()), "profile")
}
