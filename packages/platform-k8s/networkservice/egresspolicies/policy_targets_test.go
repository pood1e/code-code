package egresspolicies

import (
	"testing"

	egressv1 "code-code.internal/go-contract/egress/v1"
)

func TestTargetsForCustomRuleSupportsHostSuffix(t *testing.T) {
	rule := &egressv1.EgressRule{
		RuleId: "suffix",
		Match: &egressv1.EgressRuleMatch{
			Kind: &egressv1.EgressRuleMatch_HostSuffix{HostSuffix: "example.com"},
		},
		Action: egressv1.EgressAction_EGRESS_ACTION_DIRECT,
	}

	targets, err := targetsForCustomRule(rule, nil)
	if err != nil {
		t.Fatalf("targetsForCustomRule() error = %v", err)
	}
	if len(targets) != 2 {
		t.Fatalf("targets count = %d, want 2", len(targets))
	}

	seen := map[string]bool{}
	for _, target := range targets {
		seen[target.hostname] = true
		if target.priority != customSuffixPriority("example.com") {
			t.Fatalf("target %q priority = %d, want %d", target.hostname, target.priority, customSuffixPriority("example.com"))
		}
	}
	if !seen["example.com"] || !seen["*.example.com"] {
		t.Fatalf("targets = %+v, want example.com and *.example.com", targets)
	}
}

func TestTargetBuilderPrefersExactOverSuffix(t *testing.T) {
	builder := targetBuilder{items: map[string]egressTarget{}}

	suffixRule := &egressv1.EgressRule{
		RuleId: "suffix",
		Match: &egressv1.EgressRuleMatch{
			Kind: &egressv1.EgressRuleMatch_HostSuffix{HostSuffix: "api.example.com"},
		},
		Action: egressv1.EgressAction_EGRESS_ACTION_DIRECT,
	}
	exactRule := &egressv1.EgressRule{
		RuleId: "exact",
		Match: &egressv1.EgressRuleMatch{
			Kind: &egressv1.EgressRuleMatch_HostExact{HostExact: "api.example.com"},
		},
		Action:  egressv1.EgressAction_EGRESS_ACTION_PROXY,
		ProxyId: "preset-proxy",
	}

	suffixTargets, err := targetsForCustomRule(suffixRule, nil)
	if err != nil {
		t.Fatalf("targetsForCustomRule(suffix) error = %v", err)
	}
	for _, target := range suffixTargets {
		builder.add(target, true)
	}

	exactTargets, err := targetsForCustomRule(exactRule, []egressProxyAddress{{proxyID: "preset-proxy"}})
	if err != nil {
		t.Fatalf("targetsForCustomRule(exact) error = %v", err)
	}
	for _, target := range exactTargets {
		builder.add(target, true)
	}

	apex := builder.items["api.example.com"]
	if apex.ruleID != "exact" {
		t.Fatalf("api.example.com ruleID = %q, want exact", apex.ruleID)
	}
	if apex.action != egressActionProxy {
		t.Fatalf("api.example.com action = %q, want proxy", apex.action)
	}
	if _, ok := builder.items["*.api.example.com"]; !ok {
		t.Fatalf("expected wildcard target to remain present")
	}
}
