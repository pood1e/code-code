package egresspolicies

import (
	"testing"

	egressv1 "code-code.internal/go-contract/egress/v1"
)

func TestDefaultPolicyIncludesPresetProxy(t *testing.T) {
	policy := defaultPolicy()
	if got := len(policy.GetProxies()); got != 1 {
		t.Fatalf("default policy proxies = %d, want 1", got)
	}
	proxy := policy.GetProxies()[0]
	if proxy.GetProxyId() != presetProxyID {
		t.Fatalf("default proxy id = %q, want %q", proxy.GetProxyId(), presetProxyID)
	}
	if proxy.GetDisplayName() != presetProxyName {
		t.Fatalf("default proxy display_name = %q, want %q", proxy.GetDisplayName(), presetProxyName)
	}
	if proxy.GetUrl() != presetProxyURL {
		t.Fatalf("default proxy url = %q, want %q", proxy.GetUrl(), presetProxyURL)
	}
	if got := len(policy.GetCustomRules()); got != 1 {
		t.Fatalf("default custom rules = %d, want 1", got)
	}
	rule := policy.GetCustomRules()[0]
	if rule.GetRuleId() != externalSourceRule {
		t.Fatalf("default custom rule id = %q, want %q", rule.GetRuleId(), externalSourceRule)
	}
	if rule.GetAction() != egressv1.EgressAction_EGRESS_ACTION_PROXY {
		t.Fatalf("default custom rule action = %s, want %s", rule.GetAction(), egressv1.EgressAction_EGRESS_ACTION_PROXY)
	}
	if rule.GetProxyId() != presetProxyID {
		t.Fatalf("default custom rule proxy id = %q, want %q", rule.GetProxyId(), presetProxyID)
	}
	if policy.GetExternalRuleSet().GetSourceUrl() != externalRuleSetURL {
		t.Fatalf("default external ruleset source = %q, want %q", policy.GetExternalRuleSet().GetSourceUrl(), externalRuleSetURL)
	}
	if policy.GetExternalRuleSet().GetAction() != egressv1.EgressAction_EGRESS_ACTION_PROXY {
		t.Fatalf("default external ruleset action = %s, want %s", policy.GetExternalRuleSet().GetAction(), egressv1.EgressAction_EGRESS_ACTION_PROXY)
	}
	if policy.GetExternalRuleSet().GetProxyId() != presetProxyID {
		t.Fatalf("default external ruleset proxy id = %q, want %q", policy.GetExternalRuleSet().GetProxyId(), presetProxyID)
	}
	if policy.GetExternalRuleSet().GetEnabled() {
		t.Fatalf("default external ruleset enabled = true, want false")
	}
}

func TestNormalizePolicyTrimsCustomRuleProxyID(t *testing.T) {
	policy := normalizePolicy(&egressv1.EgressPolicy{
		PolicyId: "code-code-egress",
		CustomRules: []*egressv1.EgressRule{{
			RuleId:  "custom",
			Action:  egressv1.EgressAction_EGRESS_ACTION_PROXY,
			ProxyId: " preset-proxy ",
			Match:   &egressv1.EgressRuleMatch{Kind: &egressv1.EgressRuleMatch_HostExact{HostExact: "api.example.com"}},
		}},
	})

	rule := policy.GetCustomRules()[0]
	if rule.GetProxyId() != presetProxyID {
		t.Fatalf("proxy_id = %q, want %q", rule.GetProxyId(), presetProxyID)
	}
}

func TestNormalizePolicySeedsExternalRuleSetWhenMissing(t *testing.T) {
	policy := normalizePolicy(&egressv1.EgressPolicy{
		PolicyId:    "code-code-egress",
		DisplayName: "Egress",
	})

	ruleSet := policy.GetExternalRuleSet()
	if ruleSet == nil {
		t.Fatalf("external ruleset is nil")
	}
	if ruleSet.GetSourceUrl() != externalRuleSetURL {
		t.Fatalf("external source_url = %q, want %q", ruleSet.GetSourceUrl(), externalRuleSetURL)
	}
	if ruleSet.GetAction() != egressv1.EgressAction_EGRESS_ACTION_PROXY {
		t.Fatalf("external action = %s, want %s", ruleSet.GetAction(), egressv1.EgressAction_EGRESS_ACTION_PROXY)
	}
	if ruleSet.GetProxyId() != presetProxyID {
		t.Fatalf("external proxy_id = %q, want %q", ruleSet.GetProxyId(), presetProxyID)
	}
	if ruleSet.GetEnabled() {
		t.Fatalf("external enabled = true, want false")
	}
}
