package egresspolicies

import (
	"fmt"
	"strings"

	egressv1 "code-code.internal/go-contract/egress/v1"
	"google.golang.org/protobuf/proto"
)

func disabledExternalRuleSetStatus(ruleSet *egressv1.EgressExternalRuleSet) *egressv1.EgressExternalRuleSetStatus {
	sourceURL := ""
	if ruleSet != nil {
		sourceURL = strings.TrimSpace(ruleSet.GetSourceUrl())
	}
	return &egressv1.EgressExternalRuleSetStatus{
		Phase:     egressv1.EgressExternalRuleSetLoadPhase_EGRESS_EXTERNAL_RULE_SET_LOAD_PHASE_DISABLED,
		SourceUrl: sourceURL,
		Message:   "External AutoProxy rule set is disabled",
	}
}

func projectedExternalRuleSetStatus(
	ruleSet *egressv1.EgressExternalRuleSet,
	projection gatewayProjection,
) *egressv1.EgressExternalRuleSetStatus {
	status := disabledExternalRuleSetStatus(ruleSet)
	if ruleSet == nil || !ruleSet.GetEnabled() {
		return status
	}
	status.Phase = egressv1.EgressExternalRuleSetLoadPhase_EGRESS_EXTERNAL_RULE_SET_LOAD_PHASE_NOT_LOADED
	status.Message = "External AutoProxy rule set has not been loaded"
	for _, target := range projection.targets {
		if target.source == egressSourceRuleSet && target.ruleSetID == externalRuleSetID {
			status.LoadedHostCount++
		}
	}
	if status.LoadedHostCount > 0 {
		status.Phase = egressv1.EgressExternalRuleSetLoadPhase_EGRESS_EXTERNAL_RULE_SET_LOAD_PHASE_LOADED
		status.Message = fmt.Sprintf("AutoProxy rule set has %d applied hosts", status.LoadedHostCount)
	}
	return status
}

func effectiveExternalRuleSetStatus(
	ruleSet *egressv1.EgressExternalRuleSet,
	stored *egressv1.EgressExternalRuleSetStatus,
	projection gatewayProjection,
) *egressv1.EgressExternalRuleSetStatus {
	if ruleSet == nil || !ruleSet.GetEnabled() {
		return disabledExternalRuleSetStatus(ruleSet)
	}
	if stored != nil {
		status := proto.Clone(stored).(*egressv1.EgressExternalRuleSetStatus)
		if strings.TrimSpace(status.GetSourceUrl()) == "" {
			status.SourceUrl = strings.TrimSpace(ruleSet.GetSourceUrl())
		}
		return status
	}
	return projectedExternalRuleSetStatus(ruleSet, projection)
}
