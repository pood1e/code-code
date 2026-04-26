package support

import (
	"fmt"
	"slices"
	"strings"

	apiprotocolv1 "code-code.internal/go-contract/api_protocol/v1"
	observabilityv1 "code-code.internal/go-contract/observability/v1"
	supportv1 "code-code.internal/go-contract/platform/support/v1"
)

// ResponseHeaderRule describes one vendor-owned passive response-header rule.
type ResponseHeaderRule struct {
	HeaderName string
	MetricName string
	ValueType  observabilityv1.HeaderValueType
	Labels     map[string]string
}

// ResolveResponseHeaderRules returns deduplicated passive response-header rules
// declared by one vendor support.
func ResolveResponseHeaderRules(pkg *supportv1.Vendor) ([]ResponseHeaderRule, error) {
	if pkg == nil {
		return nil, fmt.Errorf("platformk8s/vendors: vendor support is nil")
	}
	return resolveResponseHeaderRulesFromCapabilities(vendorObservabilityCapabilities(pkg))
}

// ResolveResponseHeaderRulesForProtocol returns passive response-header rules
// for vendor API surfaces that expose the requested protocol.
func ResolveResponseHeaderRulesForProtocol(pkg *supportv1.Vendor, protocol apiprotocolv1.Protocol) ([]ResponseHeaderRule, error) {
	if pkg == nil {
		return nil, fmt.Errorf("platformk8s/vendors: vendor support is nil")
	}
	return resolveResponseHeaderRulesFromCapabilities(vendorObservabilityCapabilitiesForProtocol(pkg, protocol))
}

func resolveResponseHeaderRulesFromCapabilities(capabilities []*observabilityv1.ObservabilityCapability) ([]ResponseHeaderRule, error) {
	rulesByHeader := map[string]ResponseHeaderRule{}
	for _, capability := range capabilities {
		for _, profile := range capability.GetProfiles() {
			if profile == nil || profile.GetResponseHeaders() == nil {
				continue
			}
			for _, mapping := range profile.GetResponseHeaders().GetHeaderMetricMappings() {
				if mapping == nil {
					continue
				}
				rule := ResponseHeaderRule{
					HeaderName: strings.ToLower(strings.TrimSpace(mapping.GetHeaderName())),
					MetricName: strings.TrimSpace(mapping.GetMetricName()),
					ValueType:  mapping.GetValueType(),
					Labels:     responseHeaderLabels(mapping),
				}
				if rule.HeaderName == "" {
					continue
				}
				if existing, exists := rulesByHeader[rule.HeaderName]; exists {
					if !sameResponseHeaderRule(existing, rule) {
						return nil, fmt.Errorf("platformk8s/vendors: conflicting response header rule for %q", rule.HeaderName)
					}
					continue
				}
				rulesByHeader[rule.HeaderName] = rule
			}
		}
	}

	rules := make([]ResponseHeaderRule, 0, len(rulesByHeader))
	for _, rule := range rulesByHeader {
		rules = append(rules, rule)
	}
	slices.SortFunc(rules, func(left, right ResponseHeaderRule) int {
		return strings.Compare(left.HeaderName, right.HeaderName)
	})
	return rules, nil
}

func vendorObservabilityCapabilities(pkg *supportv1.Vendor) []*observabilityv1.ObservabilityCapability {
	if pkg == nil {
		return nil
	}
	out := make([]*observabilityv1.ObservabilityCapability, 0, len(pkg.GetProviderBindings()))
	for _, binding := range pkg.GetProviderBindings() {
		if binding == nil || binding.GetObservability() == nil {
			continue
		}
		out = append(out, binding.GetObservability())
	}
	return out
}

func vendorObservabilityCapabilitiesForProtocol(pkg *supportv1.Vendor, protocol apiprotocolv1.Protocol) []*observabilityv1.ObservabilityCapability {
	if pkg == nil || protocol == apiprotocolv1.Protocol_PROTOCOL_UNSPECIFIED {
		return nil
	}
	out := make([]*observabilityv1.ObservabilityCapability, 0, len(pkg.GetProviderBindings()))
	for _, binding := range pkg.GetProviderBindings() {
		if binding == nil || binding.GetObservability() == nil || !bindingSupportsProtocol(binding, protocol) {
			continue
		}
		out = append(out, binding.GetObservability())
	}
	return out
}

func bindingSupportsProtocol(binding *supportv1.VendorProviderBinding, protocol apiprotocolv1.Protocol) bool {
	for _, template := range binding.GetSurfaceTemplates() {
		if template == nil {
			continue
		}
		if template.GetRuntime().GetApi().GetProtocol() == protocol {
			return true
		}
	}
	return false
}

func observabilityHasActiveQuery(capability *observabilityv1.ObservabilityCapability) bool {
	if capability == nil {
		return false
	}
	for _, profile := range capability.GetProfiles() {
		if profile != nil && profile.GetActiveQuery() != nil {
			return true
		}
	}
	return false
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

func sameResponseHeaderRule(left ResponseHeaderRule, right ResponseHeaderRule) bool {
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
