package sessionapi

import (
	"embed"
	"fmt"
	"strings"

	observabilityv1 "code-code.internal/go-contract/observability/v1"
	agentrunv1 "code-code.internal/go-contract/platform/agent_run/v1"
	"sigs.k8s.io/yaml"
)

//go:embed header_metric_policies.yaml
var headerMetricPolicyFS embed.FS

type headerMetricPolicyCatalog struct {
	policies map[string]headerMetricPolicyConfig
}

type headerMetricPolicyFile struct {
	Policies []headerMetricPolicyConfig `json:"policies"`
}

type headerMetricPolicyConfig struct {
	PolicyID string                   `json:"policyId"`
	Rules    []headerMetricRuleConfig `json:"rules"`
}

type headerMetricRuleConfig struct {
	HeaderName string                    `json:"headerName"`
	MetricName string                    `json:"metricName"`
	ValueType  string                    `json:"valueType"`
	Labels     []headerMetricLabelConfig `json:"labels"`
}

type headerMetricLabelConfig struct {
	Name  string `json:"name"`
	Value string `json:"value"`
}

func loadHeaderMetricPolicyCatalog() (*headerMetricPolicyCatalog, error) {
	raw, err := headerMetricPolicyFS.ReadFile("header_metric_policies.yaml")
	if err != nil {
		return nil, err
	}
	var file headerMetricPolicyFile
	if err := yaml.Unmarshal(raw, &file); err != nil {
		return nil, fmt.Errorf("parse header metric policies: %w", err)
	}
	catalog := &headerMetricPolicyCatalog{policies: map[string]headerMetricPolicyConfig{}}
	for _, policy := range file.Policies {
		policy.PolicyID = strings.TrimSpace(policy.PolicyID)
		if policy.PolicyID == "" {
			return nil, fmt.Errorf("header metric policy id is empty")
		}
		catalog.policies[policy.PolicyID] = policy
	}
	return catalog, nil
}

func (c *headerMetricPolicyCatalog) rules(policyID string) []*agentrunv1.AgentRunResponseHeaderRule {
	if c == nil {
		return nil
	}
	policy, ok := c.policies[strings.TrimSpace(policyID)]
	if !ok {
		return nil
	}
	out := make([]*agentrunv1.AgentRunResponseHeaderRule, 0, len(policy.Rules))
	for _, rule := range policy.Rules {
		header := strings.ToLower(strings.TrimSpace(rule.HeaderName))
		metric := strings.TrimSpace(rule.MetricName)
		if header == "" || metric == "" {
			continue
		}
		out = append(out, &agentrunv1.AgentRunResponseHeaderRule{
			HeaderName: header,
			MetricName: metric,
			ValueType:  headerMetricValueType(rule.ValueType),
			Labels:     headerMetricLabels(rule.Labels),
			Context:    agentrunv1.AgentRunResponseHeaderRuleContext_AGENT_RUN_RESPONSE_HEADER_RULE_CONTEXT_UNSPECIFIED,
		})
	}
	return out
}

func headerMetricLabels(labels []headerMetricLabelConfig) []*agentrunv1.AgentRunMetricLabel {
	out := make([]*agentrunv1.AgentRunMetricLabel, 0, len(labels))
	for _, label := range labels {
		name := strings.TrimSpace(label.Name)
		value := strings.TrimSpace(label.Value)
		if name != "" && value != "" {
			out = append(out, &agentrunv1.AgentRunMetricLabel{Name: name, Value: value})
		}
	}
	return out
}

func headerMetricValueType(value string) observabilityv1.HeaderValueType {
	normalized := "HEADER_VALUE_TYPE_" + strings.ToUpper(strings.ReplaceAll(strings.TrimSpace(value), "-", "_"))
	if parsed, ok := observabilityv1.HeaderValueType_value[normalized]; ok {
		return observabilityv1.HeaderValueType(parsed)
	}
	return observabilityv1.HeaderValueType_HEADER_VALUE_TYPE_UNSPECIFIED
}
