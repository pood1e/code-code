package agentprofiles

import (
	"fmt"
	"strings"

	agentprofilev1 "code-code.internal/go-contract/platform/agent_profile/v1"
)

func selectionSummary(profile *agentprofilev1.AgentProfile) string {
	if profile == nil || profile.GetSelectionStrategy() == nil {
		return ""
	}
	selection := profile.GetSelectionStrategy()
	summary := selection.GetProviderId() + " / " + selection.GetExecutionClass()
	fallbacks := selection.GetFallbacks()
	if len(fallbacks) == 0 {
		return strings.Trim(summary, " /")
	}
	primary := fallbackModel(fallbacks[0])
	if primary == "" {
		return strings.Trim(summary, " /")
	}
	extra := len(fallbacks) - 1
	if extra > 0 {
		return fmt.Sprintf("%s · %s +%d", summary, primary, extra)
	}
	return fmt.Sprintf("%s · %s", summary, primary)
}

func fallbackModel(fallback *agentprofilev1.AgentFallbackCandidate) string {
	if fallback == nil {
		return ""
	}
	if modelRef := fallback.GetModelRef(); modelRef != nil {
		if modelRef.GetVendorId() != "" {
			return modelRef.GetVendorId() + "/" + modelRef.GetModelId()
		}
		return modelRef.GetModelId()
	}
	return fallback.GetProviderModelId()
}
