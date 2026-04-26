package rules

import (
	"strings"

	"code-code.internal/go-contract/domainerror"
	managementv1 "code-code.internal/go-contract/platform/management/v1"
	rulev1 "code-code.internal/go-contract/platform/rule/v1"
	"code-code.internal/platform-k8s/internal/resourcemeta"
	"google.golang.org/protobuf/proto"
)

type Rule struct {
	value *rulev1.Rule
}

func NewRule(input *rulev1.Rule) (*Rule, error) {
	if input == nil {
		return nil, domainerror.NewValidation("platformk8s/rules: rule is nil")
	}
	name := strings.TrimSpace(input.GetName())
	if name == "" {
		return nil, domainerror.NewValidation("platformk8s/rules: rule name is required")
	}
	content := strings.TrimSpace(input.GetContent())
	if content == "" {
		return nil, domainerror.NewValidation("platformk8s/rules: rule content is required")
	}
	ruleID, err := resourcemeta.EnsureResourceID(strings.TrimSpace(input.GetRuleId()), name, "rule")
	if err != nil {
		return nil, err
	}
	return &Rule{
		value: &rulev1.Rule{
			RuleId:      ruleID,
			Name:        name,
			Description: strings.TrimSpace(input.GetDescription()),
			Content:     content,
		},
	}, nil
}

func ruleFromStored(id string, value *rulev1.Rule) (*Rule, error) {
	if value == nil {
		return nil, domainerror.NewValidation("platformk8s/rules: rule is nil")
	}
	next := proto.Clone(value).(*rulev1.Rule)
	id = strings.TrimSpace(id)
	if next.GetRuleId() == "" {
		next.RuleId = id
	}
	if next.GetRuleId() != id {
		return nil, domainerror.NewValidation("platformk8s/rules: rule id %q does not match stored id %q", next.GetRuleId(), id)
	}
	return NewRule(next)
}

func NormalizeRuleID(ruleID string) (string, error) {
	ruleID = strings.TrimSpace(ruleID)
	if ruleID == "" {
		return "", domainerror.NewValidation("platformk8s/rules: rule id is empty")
	}
	return ruleID, nil
}

func (r *Rule) ID() string {
	if r == nil || r.value == nil {
		return ""
	}
	return strings.TrimSpace(r.value.GetRuleId())
}

func (r *Rule) Proto() *rulev1.Rule {
	if r == nil || r.value == nil {
		return nil
	}
	return proto.Clone(r.value).(*rulev1.Rule)
}

func (r *Rule) ListItem() *managementv1.RuleListItem {
	if r == nil || r.value == nil {
		return &managementv1.RuleListItem{}
	}
	return &managementv1.RuleListItem{
		RuleId:      r.value.GetRuleId(),
		Name:        r.value.GetName(),
		Description: r.value.GetDescription(),
	}
}
