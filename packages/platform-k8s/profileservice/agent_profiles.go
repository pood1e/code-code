package profileservice

import (
	"context"

	agentprofilev1 "code-code.internal/go-contract/platform/agent_profile/v1"
	managementv1 "code-code.internal/go-contract/platform/management/v1"
	"google.golang.org/protobuf/proto"
)

func (s *Server) ListAgentProfiles(ctx context.Context, _ *managementv1.ListAgentProfilesRequest) (*managementv1.ListAgentProfilesResponse, error) {
	items, err := s.profiles.List(ctx)
	if err != nil {
		return nil, grpcError(err)
	}
	return &managementv1.ListAgentProfilesResponse{Items: items}, nil
}

func (s *Server) GetAgentProfile(ctx context.Context, request *managementv1.GetAgentProfileRequest) (*managementv1.GetAgentProfileResponse, error) {
	state, err := s.profiles.GetState(ctx, request.GetProfileId())
	if err != nil {
		return nil, grpcError(err)
	}
	return &managementv1.GetAgentProfileResponse{Profile: state.Profile, Generation: state.Generation}, nil
}

func (s *Server) CreateAgentProfile(ctx context.Context, request *managementv1.CreateAgentProfileRequest) (*managementv1.CreateAgentProfileResponse, error) {
	profile, err := s.profiles.Create(ctx, agentProfileFromUpsertRequest(request.GetProfile()))
	if err != nil {
		return nil, grpcError(err)
	}
	return &managementv1.CreateAgentProfileResponse{Profile: profile}, nil
}

func (s *Server) UpdateAgentProfile(ctx context.Context, request *managementv1.UpdateAgentProfileRequest) (*managementv1.UpdateAgentProfileResponse, error) {
	profile, err := s.profiles.Update(ctx, request.GetProfileId(), agentProfileFromUpsertRequest(request.GetProfile()))
	if err != nil {
		return nil, grpcError(err)
	}
	return &managementv1.UpdateAgentProfileResponse{Profile: profile}, nil
}

func (s *Server) DeleteAgentProfile(ctx context.Context, request *managementv1.DeleteAgentProfileRequest) (*managementv1.DeleteAgentProfileResponse, error) {
	if err := s.profiles.Delete(ctx, request.GetProfileId()); err != nil {
		return nil, grpcError(err)
	}
	return &managementv1.DeleteAgentProfileResponse{Status: deleteStatusDeleted}, nil
}

func agentProfileFromUpsertRequest(request *managementv1.UpsertAgentProfileRequest) *agentprofilev1.AgentProfile {
	if request == nil {
		return nil
	}
	return &agentprofilev1.AgentProfile{
		ProfileId:         request.GetProfileId(),
		Name:              request.GetName(),
		SelectionStrategy: cloneSelectionStrategy(request.GetSelectionStrategy()),
		McpIds:            append([]string(nil), request.GetMcpIds()...),
		SkillIds:          append([]string(nil), request.GetSkillIds()...),
		RuleIds:           append([]string(nil), request.GetRuleIds()...),
	}
}

func cloneSelectionStrategy(selection *agentprofilev1.AgentSelectionStrategy) *agentprofilev1.AgentSelectionStrategy {
	if selection == nil {
		return nil
	}
	return proto.Clone(selection).(*agentprofilev1.AgentSelectionStrategy)
}
