package envoyauthprocessor

import (
	"encoding/json"
	"strings"
)

func responseHeaderRulesFromJSON(raw string) []responseHeaderRule {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil
	}
	var rules []responseHeaderRule
	if err := json.Unmarshal([]byte(raw), &rules); err != nil {
		return nil
	}
	out := make([]responseHeaderRule, 0, len(rules))
	for _, rule := range rules {
		rule.HeaderName = strings.ToLower(strings.TrimSpace(rule.HeaderName))
		rule.MetricName = strings.TrimSpace(rule.MetricName)
		rule.ValueType = strings.TrimSpace(rule.ValueType)
		rule.Context = strings.TrimSpace(rule.Context)
		if rule.HeaderName != "" {
			out = append(out, rule)
		}
	}
	return out
}
