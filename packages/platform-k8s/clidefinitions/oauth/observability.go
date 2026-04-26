package oauth

import (
	"fmt"
	"slices"
	"strings"

	observabilityv1 "code-code.internal/go-contract/observability/v1"
	supportv1 "code-code.internal/go-contract/platform/support/v1"
)

// OAuthResponseHeaderRule describes one sidecar-capturable runtime header rule.
type OAuthResponseHeaderRule struct {
	HeaderName string
	MetricName string
	ValueType  observabilityv1.HeaderValueType
	Labels     map[string]string
}

// ResolveOAuthResponseHeaderRules returns deduplicated runtime header capture
// rules declared by oauth.observability response-header profiles.
func ResolveOAuthResponseHeaderRules(cli *supportv1.CLI) ([]OAuthResponseHeaderRule, error) {
	if cli == nil {
		return nil, fmt.Errorf("platformk8s/clidefinitions: cli support is nil")
	}
	if cli.GetOauth() == nil {
		return nil, nil
	}
	capability := cli.GetOauth().GetObservability()
	if capability == nil {
		return nil, nil
	}

	rulesByHeader := map[string]OAuthResponseHeaderRule{}
	for _, profile := range capability.GetProfiles() {
		if profile == nil || profile.GetResponseHeaders() == nil {
			continue
		}
		for _, mapping := range profile.GetResponseHeaders().GetHeaderMetricMappings() {
			if mapping == nil {
				continue
			}
			rule := OAuthResponseHeaderRule{
				HeaderName: strings.ToLower(strings.TrimSpace(mapping.GetHeaderName())),
				MetricName: strings.TrimSpace(mapping.GetMetricName()),
				ValueType:  mapping.GetValueType(),
				Labels:     responseHeaderLabels(mapping),
			}
			if rule.HeaderName == "" {
				continue
			}
			if existing, exists := rulesByHeader[rule.HeaderName]; exists {
				if !sameOAuthResponseHeaderRule(existing, rule) {
					return nil, fmt.Errorf("platformk8s/clidefinitions: conflicting response header rule for %q", rule.HeaderName)
				}
				continue
			}
			rulesByHeader[rule.HeaderName] = rule
		}
	}

	rules := make([]OAuthResponseHeaderRule, 0, len(rulesByHeader))
	for _, rule := range rulesByHeader {
		rules = append(rules, rule)
	}
	slices.SortFunc(rules, func(left, right OAuthResponseHeaderRule) int {
		return strings.Compare(left.HeaderName, right.HeaderName)
	})
	return rules, nil
}

func responseHeaderLabels(mapping *observabilityv1.HeaderMetricMapping) map[string]string {
	if mapping == nil || len(mapping.GetLabels()) == 0 {
		return nil
	}
	labels := make(map[string]string, len(mapping.GetLabels()))
	for _, label := range mapping.GetLabels() {
		if label == nil {
			continue
		}
		name := strings.TrimSpace(label.GetName())
		value := strings.TrimSpace(label.GetValue())
		if name == "" || value == "" {
			continue
		}
		labels[name] = value
	}
	if len(labels) == 0 {
		return nil
	}
	return labels
}

func sameOAuthResponseHeaderRule(left OAuthResponseHeaderRule, right OAuthResponseHeaderRule) bool {
	if left.HeaderName != right.HeaderName || left.MetricName != right.MetricName || left.ValueType != right.ValueType {
		return false
	}
	if len(left.Labels) != len(right.Labels) {
		return false
	}
	for key, value := range left.Labels {
		if right.Labels[key] != value {
			return false
		}
	}
	return true
}
