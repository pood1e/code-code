package sessionapi

import (
	"slices"
	"strings"

	agentrunv1 "code-code.internal/go-contract/platform/agent_run/v1"
)

func dedupeAgentRunResponseHeaderRules(rules []*agentrunv1.AgentRunResponseHeaderRule) []*agentrunv1.AgentRunResponseHeaderRule {
	out := make([]*agentrunv1.AgentRunResponseHeaderRule, 0, len(rules))
	seen := map[string]struct{}{}
	for _, rule := range rules {
		if rule == nil {
			continue
		}
		rule.HeaderName = strings.ToLower(strings.TrimSpace(rule.GetHeaderName()))
		rule.MetricName = strings.TrimSpace(rule.GetMetricName())
		if rule.GetHeaderName() == "" || rule.GetMetricName() == "" {
			continue
		}
		key := responseHeaderRuleKey(rule)
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		out = append(out, rule)
	}
	return out
}

func responseHeaderRuleKey(rule *agentrunv1.AgentRunResponseHeaderRule) string {
	parts := []string{
		rule.GetHeaderName(),
		rule.GetMetricName(),
		rule.GetValueType().String(),
		rule.GetContext().String(),
	}
	labels := make([]string, 0, len(rule.GetLabels()))
	for _, label := range rule.GetLabels() {
		labels = append(labels, strings.TrimSpace(label.GetName())+"="+strings.TrimSpace(label.GetValue()))
	}
	slices.Sort(labels)
	parts = append(parts, labels...)
	return strings.Join(parts, "\x00")
}
