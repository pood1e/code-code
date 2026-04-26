package profileservice

import (
	"context"

	managementv1 "code-code.internal/go-contract/platform/management/v1"
	skillv1 "code-code.internal/go-contract/platform/skill/v1"
)

func (s *Server) ListSkills(ctx context.Context, _ *managementv1.ListSkillsRequest) (*managementv1.ListSkillsResponse, error) {
	items, err := s.skills.List(ctx)
	if err != nil {
		return nil, grpcError(err)
	}
	return &managementv1.ListSkillsResponse{Items: items}, nil
}

func (s *Server) GetSkill(ctx context.Context, request *managementv1.GetSkillRequest) (*managementv1.GetSkillResponse, error) {
	skill, err := s.skills.Get(ctx, request.GetSkillId())
	if err != nil {
		return nil, grpcError(err)
	}
	return &managementv1.GetSkillResponse{Skill: skill}, nil
}

func (s *Server) CreateSkill(ctx context.Context, request *managementv1.CreateSkillRequest) (*managementv1.CreateSkillResponse, error) {
	skill, err := s.skills.Create(ctx, skillFromUpsertRequest(request.GetSkill()))
	if err != nil {
		return nil, grpcError(err)
	}
	return &managementv1.CreateSkillResponse{Skill: skill}, nil
}

func (s *Server) UpdateSkill(ctx context.Context, request *managementv1.UpdateSkillRequest) (*managementv1.UpdateSkillResponse, error) {
	skill, err := s.skills.Update(ctx, request.GetSkillId(), skillFromUpsertRequest(request.GetSkill()))
	if err != nil {
		return nil, grpcError(err)
	}
	return &managementv1.UpdateSkillResponse{Skill: skill}, nil
}

func (s *Server) DeleteSkill(ctx context.Context, request *managementv1.DeleteSkillRequest) (*managementv1.DeleteSkillResponse, error) {
	if err := s.skills.Delete(ctx, request.GetSkillId()); err != nil {
		return nil, grpcError(err)
	}
	return &managementv1.DeleteSkillResponse{Status: deleteStatusDeleted}, nil
}

func skillFromUpsertRequest(request *managementv1.UpsertSkillRequest) *skillv1.Skill {
	if request == nil {
		return nil
	}
	return &skillv1.Skill{
		SkillId:     request.GetSkillId(),
		Name:        request.GetName(),
		Description: request.GetDescription(),
		Content:     request.GetContent(),
	}
}
