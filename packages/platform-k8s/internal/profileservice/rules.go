package profileservice

import (
	"context"

	managementv1 "code-code.internal/go-contract/platform/management/v1"
	rulev1 "code-code.internal/go-contract/platform/rule/v1"
)

func (s *Server) ListRules(ctx context.Context, _ *managementv1.ListRulesRequest) (*managementv1.ListRulesResponse, error) {
	items, err := s.rules.List(ctx)
	if err != nil {
		return nil, grpcError(err)
	}
	return &managementv1.ListRulesResponse{Items: items}, nil
}

func (s *Server) GetRule(ctx context.Context, request *managementv1.GetRuleRequest) (*managementv1.GetRuleResponse, error) {
	rule, err := s.rules.Get(ctx, request.GetRuleId())
	if err != nil {
		return nil, grpcError(err)
	}
	return &managementv1.GetRuleResponse{Rule: rule}, nil
}

func (s *Server) CreateRule(ctx context.Context, request *managementv1.CreateRuleRequest) (*managementv1.CreateRuleResponse, error) {
	rule, err := s.rules.Create(ctx, ruleFromUpsertRequest(request.GetRule()))
	if err != nil {
		return nil, grpcError(err)
	}
	return &managementv1.CreateRuleResponse{Rule: rule}, nil
}

func (s *Server) UpdateRule(ctx context.Context, request *managementv1.UpdateRuleRequest) (*managementv1.UpdateRuleResponse, error) {
	rule, err := s.rules.Update(ctx, request.GetRuleId(), ruleFromUpsertRequest(request.GetRule()))
	if err != nil {
		return nil, grpcError(err)
	}
	return &managementv1.UpdateRuleResponse{Rule: rule}, nil
}

func (s *Server) DeleteRule(ctx context.Context, request *managementv1.DeleteRuleRequest) (*managementv1.DeleteRuleResponse, error) {
	if err := s.rules.Delete(ctx, request.GetRuleId()); err != nil {
		return nil, grpcError(err)
	}
	return &managementv1.DeleteRuleResponse{Status: deleteStatusDeleted}, nil
}

func ruleFromUpsertRequest(request *managementv1.UpsertRuleRequest) *rulev1.Rule {
	if request == nil {
		return nil
	}
	return &rulev1.Rule{
		RuleId:      request.GetRuleId(),
		Name:        request.GetName(),
		Description: request.GetDescription(),
		Content:     request.GetContent(),
	}
}
