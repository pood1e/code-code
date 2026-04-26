package agentrunauth

import (
	"crypto/sha1"
	"encoding/json"
	"fmt"
	"strings"

	agentrunv1 "code-code.internal/go-contract/platform/agent_run/v1"
	managementv1 "code-code.internal/go-contract/platform/management/v1"
	"code-code.internal/platform-k8s/egressauth"
)

// Projection describes the fake runtime Secret consumed by envoy-auth-processor.
type Projection struct {
	SourceName                     string
	MaterializationKey             string
	RuntimeURL                     string
	TargetHosts                    []string
	TargetPathPrefixes             []string
	RequestHeaderNames             []string
	HeaderValuePrefix              string
	RequestHeaderReplacementRules  []*managementv1.AgentRunRuntimeHeaderReplacementRule
	ResponseHeaderReplacementRules []*managementv1.AgentRunRuntimeHeaderReplacementRule
	ResponseHeaderMetricRules      []*agentrunv1.AgentRunResponseHeaderRule
	EgressPolicyID                 string
	AuthPolicyID                   string
	HeaderMetricPolicyID           string
	ProviderID                     string
	VendorID                       string
	ProviderSurfaceBindingID       string
	CLIID                          string
}

// SecretAnnotations serializes projection metadata onto the runtime Secret.
func SecretAnnotations(projection Projection) map[string]string {
	return map[string]string{
		egressauth.ProjectedCredentialSourceAnnotation: strings.TrimSpace(projection.SourceName),
		egressauth.AnnotationAuthMaterializationKey:    strings.TrimSpace(projection.MaterializationKey),
		egressauth.AnnotationRuntimeURL:                strings.TrimSpace(projection.RuntimeURL),
		egressauth.AnnotationTargetHosts:               joinComma(projection.TargetHosts),
		egressauth.AnnotationTargetPathPrefixes:        joinComma(projection.TargetPathPrefixes),
		egressauth.AnnotationRequestHeaderNames:        joinComma(projection.RequestHeaderNames),
		egressauth.AnnotationHeaderValuePrefix:         strings.TrimSpace(projection.HeaderValuePrefix),
		egressauth.AnnotationRequestHeaderRulesJSON:    mustJSON(headerReplacementRuleAnnotations(projection.RequestHeaderReplacementRules)),
		egressauth.AnnotationProviderID:                strings.TrimSpace(projection.ProviderID),
		egressauth.AnnotationVendorID:                  strings.TrimSpace(projection.VendorID),
		egressauth.AnnotationProviderSurfaceBindingID:  strings.TrimSpace(projection.ProviderSurfaceBindingID),
		egressauth.AnnotationCLIID:                     strings.TrimSpace(projection.CLIID),
		egressauth.AnnotationEgressPolicyID:            strings.TrimSpace(projection.EgressPolicyID),
		egressauth.AnnotationAuthPolicyID:              strings.TrimSpace(projection.AuthPolicyID),
		egressauth.AnnotationHeaderMetricPolicyID:      strings.TrimSpace(projection.HeaderMetricPolicyID),
		egressauth.AnnotationResponseHeaderRulesJSON:   mustJSON(headerReplacementRuleAnnotations(projection.ResponseHeaderReplacementRules)),
		egressauth.AnnotationResponseHeaderMetricsJSON: mustJSON(responseHeaderMetricRuleAnnotations(projection.ResponseHeaderMetricRules)),
	}
}

// SourceSecretName normalizes the control-plane Secret name that stores credential material.
func SourceSecretName(secretName string) string {
	return strings.TrimSpace(secretName)
}

// ProjectedSecretName returns the deterministic runtime Secret name for one run.
func ProjectedSecretName(namespace, runName, runID string) string {
	runName = strings.TrimSpace(runName)
	runID = strings.TrimSpace(runID)
	if runName == "" || runID == "" {
		return ""
	}
	key := strings.TrimSpace(namespace) + "/" + runName + "/" + runID
	sum := sha1.Sum([]byte(key))
	return fmt.Sprintf("agent-run-credential-%x", sum[:5])
}

func joinComma(values []string) string {
	if len(values) == 0 {
		return ""
	}
	items := make([]string, 0, len(values))
	for _, value := range values {
		if item := strings.TrimSpace(value); item != "" {
			items = append(items, item)
		}
	}
	return strings.Join(items, ",")
}

func mustJSON(value any) string {
	if value == nil {
		return ""
	}
	data, err := json.Marshal(value)
	if err != nil || string(data) == "null" || string(data) == "[]" {
		return ""
	}
	return string(data)
}

func headerReplacementRuleAnnotations(rules []*managementv1.AgentRunRuntimeHeaderReplacementRule) []egressauth.SimpleReplacementRule {
	out := make([]egressauth.SimpleReplacementRule, 0, len(rules))
	for _, rule := range rules {
		if rule == nil {
			continue
		}
		out = append(out, egressauth.SimpleReplacementRule{
			Mode:              strings.TrimSpace(rule.GetMode()),
			HeaderName:        strings.TrimSpace(rule.GetHeaderName()),
			MaterialKey:       strings.TrimSpace(rule.GetMaterialKey()),
			HeaderValuePrefix: strings.TrimSpace(rule.GetHeaderValuePrefix()),
			Template:          strings.TrimSpace(rule.GetTemplate()),
		})
	}
	return out
}

type responseHeaderMetricRuleAnnotation struct {
	HeaderName string                                `json:"headerName"`
	MetricName string                                `json:"metricName"`
	ValueType  string                                `json:"valueType"`
	Labels     []responseHeaderMetricLabelAnnotation `json:"labels,omitempty"`
	Context    string                                `json:"context"`
}

type responseHeaderMetricLabelAnnotation struct {
	Name  string `json:"name"`
	Value string `json:"value"`
}

func responseHeaderMetricRuleAnnotations(rules []*agentrunv1.AgentRunResponseHeaderRule) []responseHeaderMetricRuleAnnotation {
	out := make([]responseHeaderMetricRuleAnnotation, 0, len(rules))
	for _, rule := range rules {
		if rule == nil {
			continue
		}
		labels := make([]responseHeaderMetricLabelAnnotation, 0, len(rule.GetLabels()))
		for _, label := range rule.GetLabels() {
			labels = append(labels, responseHeaderMetricLabelAnnotation{
				Name:  strings.TrimSpace(label.GetName()),
				Value: strings.TrimSpace(label.GetValue()),
			})
		}
		out = append(out, responseHeaderMetricRuleAnnotation{
			HeaderName: strings.TrimSpace(rule.GetHeaderName()),
			MetricName: strings.TrimSpace(rule.GetMetricName()),
			ValueType:  strings.TrimPrefix(rule.GetValueType().String(), "HEADER_VALUE_TYPE_"),
			Labels:     labels,
			Context:    strings.TrimPrefix(rule.GetContext().String(), "AGENT_RUN_RESPONSE_HEADER_RULE_CONTEXT_"),
		})
	}
	return out
}
