package egresspolicies

import (
	"fmt"
	"strings"

	egressv1 "code-code.internal/go-contract/egress/v1"
)

const (
	targetPrioritySystem           = 100
	targetPriorityCustomSuffixBase = 1000
	targetPriorityCustomExactBase  = 10000
)

type targetBuilder struct {
	items map[string]egressTarget
}

func (b *targetBuilder) add(target egressTarget, replace bool) {
	if current, ok := b.items[target.hostname]; ok {
		if !replace {
			b.items[target.hostname] = current
			return
		}
		if target.priority < current.priority {
			return
		}
	}
	b.items[target.hostname] = target
}

func (b *targetBuilder) values() []egressTarget {
	out := make([]egressTarget, 0, len(b.items))
	for _, item := range b.items {
		out = append(out, item)
	}
	return out
}

func targetsForCustomRule(rule *egressv1.EgressRule, proxies []egressProxyAddress) ([]egressTarget, error) {
	if rule == nil || rule.GetMatch() == nil {
		return nil, fmt.Errorf("custom rule match is required")
	}
	action, proxyID, err := requestedAction(rule.GetAction(), rule.GetProxyId(), rule.GetRuleId(), proxies)
	if err != nil {
		return nil, err
	}
	ruleID := strings.TrimSpace(rule.GetRuleId())
	switch match := rule.GetMatch().GetKind().(type) {
	case *egressv1.EgressRuleMatch_HostExact:
		target, err := newTarget(match.HostExact)
		if err != nil {
			return nil, err
		}
		target.source = egressSourceCustom
		target.ruleID = ruleID
		target.displayName = displayNameOr(rule.GetDisplayName(), target.hostname)
		target.action = action
		target.proxyID = proxyID
		target.priority = customExactPriority(target.hostname)
		return []egressTarget{target}, nil
	case *egressv1.EgressRuleMatch_HostSuffix:
		suffix, err := parseSuffixHostname(match.HostSuffix)
		if err != nil {
			return nil, err
		}
		suffixPattern := wildcardHostForSuffix(suffix)
		baseDisplayName := displayNameOr(rule.GetDisplayName(), suffixPattern)
		specificity := customSuffixPriority(suffix)
		targets := make([]egressTarget, 0, 2)
		for _, hostPattern := range []string{suffix, suffixPattern} {
			target, err := newTargetForHostPattern(hostPattern)
			if err != nil {
				return nil, err
			}
			target.source = egressSourceCustom
			target.ruleID = ruleID
			target.displayName = baseDisplayName
			target.action = action
			target.proxyID = proxyID
			target.priority = specificity
			targets = append(targets, target)
		}
		return targets, nil
	default:
		return nil, fmt.Errorf("custom rule %q must use exact or suffix host match", rule.GetRuleId())
	}
}

func validateCustomRule(rule *egressv1.EgressRule, proxies []egressProxyAddress) error {
	if rule == nil || rule.GetMatch() == nil {
		return fmt.Errorf("custom rule match is required")
	}
	if _, _, err := requestedAction(rule.GetAction(), rule.GetProxyId(), rule.GetRuleId(), proxies); err != nil {
		return err
	}
	switch match := rule.GetMatch().GetKind().(type) {
	case *egressv1.EgressRuleMatch_HostExact:
		_, err := parseExactHostname(match.HostExact)
		return err
	case *egressv1.EgressRuleMatch_HostSuffix:
		_, err := parseSuffixHostname(match.HostSuffix)
		return err
	default:
		return fmt.Errorf("custom rule %q must use exact or suffix host match", rule.GetRuleId())
	}
}

func requestedAction(
	action egressv1.EgressAction,
	proxyID string,
	sourceID string,
	proxies []egressProxyAddress,
) (string, string, error) {
	switch action {
	case egressv1.EgressAction_EGRESS_ACTION_UNSPECIFIED, egressv1.EgressAction_EGRESS_ACTION_DIRECT:
		return egressActionDirect, "", nil
	case egressv1.EgressAction_EGRESS_ACTION_PROXY:
		proxyID = strings.TrimSpace(proxyID)
		if !hasProxyID(proxies, proxyID) {
			return "", "", fmt.Errorf("egress proxy %q referenced by %q is not declared", proxyID, sourceID)
		}
		return egressActionProxy, proxyID, nil
	default:
		return "", "", fmt.Errorf("egress action for %q must be direct or proxy", sourceID)
	}
}

func hasProxyID(proxies []egressProxyAddress, proxyID string) bool {
	for _, proxy := range proxies {
		if proxy.proxyID == proxyID {
			return true
		}
	}
	return false
}

func customExactPriority(hostname string) int {
	return targetPriorityCustomExactBase + len(strings.TrimSpace(hostname))
}

func customSuffixPriority(suffix string) int {
	return targetPriorityCustomSuffixBase + len(strings.TrimSpace(suffix))
}
