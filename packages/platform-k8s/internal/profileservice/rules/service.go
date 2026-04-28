package rules

import (
	"context"
	"fmt"
	"slices"
	"strings"

	managementv1 "code-code.internal/go-contract/platform/management/v1"
	rulev1 "code-code.internal/go-contract/platform/rule/v1"
	"google.golang.org/protobuf/proto"
)

type ProfileReferenceUpdater interface {
	DetachRule(ctx context.Context, ruleID string) error
}

type Service struct {
	store    Store
	profiles ProfileReferenceUpdater
}

func NewService(store Store, profiles ProfileReferenceUpdater) (*Service, error) {
	if store == nil {
		return nil, fmt.Errorf("platformk8s/rules: store is nil")
	}
	if profiles == nil {
		return nil, fmt.Errorf("platformk8s/rules: profile reference updater is nil")
	}
	return &Service{
		store:    store,
		profiles: profiles,
	}, nil
}

func (s *Service) List(ctx context.Context) ([]*managementv1.RuleListItem, error) {
	rules, err := s.store.List(ctx)
	if err != nil {
		return nil, fmt.Errorf("platformk8s/rules: list rules: %w", err)
	}
	items := make([]*managementv1.RuleListItem, 0, len(rules))
	for _, rule := range rules {
		items = append(items, rule.ListItem())
	}
	slices.SortFunc(items, func(a, b *managementv1.RuleListItem) int {
		if a.GetName() != b.GetName() {
			return strings.Compare(a.GetName(), b.GetName())
		}
		return strings.Compare(a.GetRuleId(), b.GetRuleId())
	})
	return items, nil
}

func (s *Service) Get(ctx context.Context, ruleID string) (*rulev1.Rule, error) {
	rule, err := s.store.Load(ctx, ruleID)
	if err != nil {
		return nil, err
	}
	return rule.Proto(), nil
}

func (s *Service) Create(ctx context.Context, input *rulev1.Rule) (*rulev1.Rule, error) {
	rule, err := NewRule(input)
	if err != nil {
		return nil, err
	}
	if err := s.store.Create(ctx, rule); err != nil {
		return nil, err
	}
	return rule.Proto(), nil
}

func (s *Service) Update(ctx context.Context, ruleID string, input *rulev1.Rule) (*rulev1.Rule, error) {
	rule, err := NewRule(ruleWithID(input, ruleID))
	if err != nil {
		return nil, err
	}
	if err := s.store.Update(ctx, rule); err != nil {
		return nil, err
	}
	return rule.Proto(), nil
}

func (s *Service) Delete(ctx context.Context, ruleID string) error {
	nextRuleID, err := NormalizeRuleID(ruleID)
	if err != nil {
		return err
	}
	if err := s.profiles.DetachRule(ctx, nextRuleID); err != nil {
		return err
	}
	return s.store.Delete(ctx, nextRuleID)
}

func ruleWithID(input *rulev1.Rule, ruleID string) *rulev1.Rule {
	next := &rulev1.Rule{}
	if input != nil {
		next = proto.Clone(input).(*rulev1.Rule)
	}
	next.RuleId = strings.TrimSpace(ruleID)
	return next
}
