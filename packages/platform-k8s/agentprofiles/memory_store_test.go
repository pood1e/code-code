package agentprofiles

import (
	"context"
	"strings"

	agentprofilev1 "code-code.internal/go-contract/platform/agent_profile/v1"
	"google.golang.org/protobuf/proto"
)

type memoryProfileStore struct {
	items map[string]*ProfileState
}

func newMemoryProfileStore() *memoryProfileStore {
	return &memoryProfileStore{items: map[string]*ProfileState{}}
}

func (s *memoryProfileStore) List(context.Context) ([]*ProfileState, error) {
	states := make([]*ProfileState, 0, len(s.items))
	for _, state := range s.items {
		states = append(states, cloneProfileState(state))
	}
	return states, nil
}

func (s *memoryProfileStore) Get(_ context.Context, profileID string) (*ProfileState, error) {
	profileID = strings.TrimSpace(profileID)
	state := s.items[profileID]
	if state == nil {
		return nil, profileNotFound(profileID)
	}
	return cloneProfileState(state), nil
}

func (s *memoryProfileStore) Create(_ context.Context, profile *agentprofilev1.AgentProfile) (*ProfileState, error) {
	profileID := strings.TrimSpace(profile.GetProfileId())
	if _, exists := s.items[profileID]; exists {
		return nil, alreadyExists(profileID)
	}
	state := &ProfileState{Profile: cloneProfile(profile), Generation: 1}
	s.items[profileID] = state
	return cloneProfileState(state), nil
}

func (s *memoryProfileStore) Update(_ context.Context, profileID string, profile *agentprofilev1.AgentProfile) (*ProfileState, error) {
	profileID = strings.TrimSpace(profileID)
	current := s.items[profileID]
	if current == nil {
		return nil, profileNotFound(profileID)
	}
	state := &ProfileState{Profile: cloneProfile(profile), Generation: current.Generation + 1}
	s.items[profileID] = state
	return cloneProfileState(state), nil
}

func (s *memoryProfileStore) Delete(_ context.Context, profileID string) error {
	delete(s.items, strings.TrimSpace(profileID))
	return nil
}

func (s *memoryProfileStore) put(profile *agentprofilev1.AgentProfile) {
	profileID := strings.TrimSpace(profile.GetProfileId())
	s.items[profileID] = &ProfileState{Profile: cloneProfile(profile), Generation: 1}
}

func cloneProfileState(state *ProfileState) *ProfileState {
	if state == nil {
		return nil
	}
	return &ProfileState{Profile: cloneProfile(state.Profile), Generation: state.Generation}
}

func cloneProfile(profile *agentprofilev1.AgentProfile) *agentprofilev1.AgentProfile {
	if profile == nil {
		return nil
	}
	return proto.Clone(profile).(*agentprofilev1.AgentProfile)
}
