package egresspolicies

import (
	"context"
	"fmt"
	"strings"

	egressv1 "code-code.internal/go-contract/egress/v1"
)

type gatewayDesiredState struct {
	targets []egressTarget
	proxies []egressProxyAddress
}

func desiredStateFromPolicy(
	ctx context.Context,
	policy *egressv1.EgressPolicy,
	current gatewayProjection,
	loader externalRuleSetLoader,
) (gatewayDesiredState, *egressv1.EgressExternalRuleSetStatus, error) {
	if policy == nil {
		return gatewayDesiredState{}, nil, fmt.Errorf("egress policy is required")
	}
	proxies, err := desiredProxies(policy)
	if err != nil {
		return gatewayDesiredState{}, nil, err
	}
	builder := targetBuilder{items: map[string]egressTarget{}}
	for _, target := range current.targets {
		switch target.source {
		case egressSourceSystem:
			target.action = egressActionDirect
			target.proxyID = ""
			target.priority = targetPrioritySystem
			builder.add(target, false)
		}
	}
	externalStatus := loadExternalRuleSetStatus(ctx, policy.GetExternalRuleSet(), proxies, loader)
	for _, rule := range policy.GetCustomRules() {
		// custom_rules are evaluated by the runtime matcher, not materialized as Istio route resources.
		if err := validateCustomRule(rule, proxies); err != nil {
			return gatewayDesiredState{}, externalStatus, err
		}
	}
	targets := builder.values()
	sortTargets(targets)
	return gatewayDesiredState{targets: targets, proxies: proxies}, externalStatus, nil
}

func desiredProxies(policy *egressv1.EgressPolicy) ([]egressProxyAddress, error) {
	out := make([]egressProxyAddress, 0, len(policy.GetProxies()))
	seen := map[string]struct{}{}
	for _, proxy := range policy.GetProxies() {
		id := strings.TrimSpace(proxy.GetProxyId())
		if id == "" {
			return nil, fmt.Errorf("egress proxy id is required")
		}
		if _, ok := seen[id]; ok {
			return nil, fmt.Errorf("duplicate egress proxy %q", id)
		}
		seen[id] = struct{}{}
		parsed, err := parseHTTPProxyAddress(id, proxy.GetUrl())
		if err != nil {
			return nil, err
		}
		parsed.displayName = displayNameOr(proxy.GetDisplayName(), id)
		out = append(out, *parsed)
	}
	sortProxies(out)
	return out, nil
}

func loadExternalRuleSetStatus(
	ctx context.Context,
	ruleSet *egressv1.EgressExternalRuleSet,
	proxies []egressProxyAddress,
	loader externalRuleSetLoader,
) *egressv1.EgressExternalRuleSetStatus {
	status := disabledExternalRuleSetStatus(ruleSet)
	if ruleSet == nil || !ruleSet.GetEnabled() {
		return status
	}
	if strings.TrimSpace(ruleSet.GetSourceUrl()) == "" {
		status.Phase = egressv1.EgressExternalRuleSetLoadPhase_EGRESS_EXTERNAL_RULE_SET_LOAD_PHASE_FAILED
		status.Message = "AutoProxy URL is required when the external rule set is enabled"
		return status
	}
	action, proxyID, err := requestedAction(ruleSet.GetAction(), ruleSet.GetProxyId(), externalRuleSetID, proxies)
	if err != nil {
		status.Phase = egressv1.EgressExternalRuleSetLoadPhase_EGRESS_EXTERNAL_RULE_SET_LOAD_PHASE_FAILED
		status.Message = err.Error()
		return status
	}
	proxyURL := ""
	if action == egressActionProxy {
		resolvedURL, ok := proxyURLForID(proxies, proxyID)
		if !ok {
			status.Phase = egressv1.EgressExternalRuleSetLoadPhase_EGRESS_EXTERNAL_RULE_SET_LOAD_PHASE_FAILED
			status.Message = fmt.Sprintf("egress proxy %q referenced by %q is not declared", proxyID, externalRuleSetID)
			return status
		}
		proxyURL = resolvedURL
	}
	load, err := loader.Load(ctx, ruleSet.GetSourceUrl(), proxyURL)
	if err != nil {
		status.Phase = egressv1.EgressExternalRuleSetLoadPhase_EGRESS_EXTERNAL_RULE_SET_LOAD_PHASE_FAILED
		status.Message = err.Error()
		return status
	}
	status.Phase = egressv1.EgressExternalRuleSetLoadPhase_EGRESS_EXTERNAL_RULE_SET_LOAD_PHASE_LOADED
	status.LoadedHostCount = int32(len(load.hosts))
	status.SkippedRuleCount = load.skippedRules
	status.LoadedAt = load.loadedAt
	status.Message = "AutoProxy rule set loaded into proxy-side matcher"
	if status.LoadedHostCount == 0 {
		status.Phase = egressv1.EgressExternalRuleSetLoadPhase_EGRESS_EXTERNAL_RULE_SET_LOAD_PHASE_NOT_LOADED
		status.Message = "AutoProxy rule set did not contain supported host rules"
	}
	return status
}

func proxyURLForID(proxies []egressProxyAddress, proxyID string) (string, bool) {
	for _, proxy := range proxies {
		if proxy.proxyID == proxyID {
			return proxyURL(proxy), true
		}
	}
	return "", false
}
