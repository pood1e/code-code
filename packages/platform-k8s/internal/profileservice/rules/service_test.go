package rules

import (
	"context"
	"testing"

	"code-code.internal/go-contract/domainerror"
	rulev1 "code-code.internal/go-contract/platform/rule/v1"
)

func TestServiceListReturnsStoredRules(t *testing.T) {
	t.Parallel()

	store := newMemoryRuleStore(t,
		&rulev1.Rule{RuleId: "z-rule", Name: "Z Rule", Content: "Use exact dates."},
		&rulev1.Rule{RuleId: "a-rule", Name: "A Rule", Content: "Be concise."},
	)
	service, err := NewService(store, noopProfileReferenceUpdater{})
	if err != nil {
		t.Fatalf("NewService() error = %v", err)
	}

	items, err := service.List(context.Background())
	if err != nil {
		t.Fatalf("List() error = %v", err)
	}
	if got, want := len(items), 2; got != want {
		t.Fatalf("len(items) = %d, want %d", got, want)
	}
	if got, want := items[0].GetRuleId(), "a-rule"; got != want {
		t.Fatalf("rule_id = %q, want %q", got, want)
	}
}

type memoryRuleStore struct {
	items map[string]*Rule
}

func newMemoryRuleStore(t *testing.T, values ...*rulev1.Rule) *memoryRuleStore {
	t.Helper()

	store := &memoryRuleStore{items: map[string]*Rule{}}
	for _, value := range values {
		rule, err := NewRule(value)
		if err != nil {
			t.Fatalf("NewRule() error = %v", err)
		}
		store.items[rule.ID()] = rule
	}
	return store
}

func (s *memoryRuleStore) List(context.Context) ([]*Rule, error) {
	out := make([]*Rule, 0, len(s.items))
	for _, item := range s.items {
		out = append(out, item)
	}
	return out, nil
}

func (s *memoryRuleStore) Load(_ context.Context, ruleID string) (*Rule, error) {
	if item, ok := s.items[ruleID]; ok {
		return item, nil
	}
	return nil, domainerror.NewNotFound("test rule %q not found", ruleID)
}

func (s *memoryRuleStore) Create(_ context.Context, rule *Rule) error {
	s.items[rule.ID()] = rule
	return nil
}

func (s *memoryRuleStore) Update(_ context.Context, rule *Rule) error {
	s.items[rule.ID()] = rule
	return nil
}

func (s *memoryRuleStore) Delete(_ context.Context, ruleID string) error {
	delete(s.items, ruleID)
	return nil
}

type noopProfileReferenceUpdater struct{}

func (noopProfileReferenceUpdater) DetachRule(context.Context, string) error {
	return nil
}
