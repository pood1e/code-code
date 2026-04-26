package egresspolicies

import (
	"fmt"
	"strings"

	egressv1 "code-code.internal/go-contract/egress/v1"
	"google.golang.org/protobuf/types/known/timestamppb"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

func syncStatus(policy *egressv1.EgressPolicy, namespace string, projection gatewayProjection) *egressv1.EgressSyncStatus {
	status := &egressv1.EgressSyncStatus{
		Phase:  egressv1.EgressSyncPhase_EGRESS_SYNC_PHASE_PENDING,
		Reason: "Istio egress resources are pending",
		TargetGateway: &egressv1.EgressResourceRef{
			Kind:      "Gateway",
			Namespace: namespace,
			Name:      gatewayName,
		},
		AppliedResources: appliedResources(projection),
	}
	if !policyHasManagedTargets(policy) && len(projection.targets) == 0 {
		status.Phase = egressv1.EgressSyncPhase_EGRESS_SYNC_PHASE_SYNCED
		status.Reason = "No managed Istio egress routes configured"
		if projection.gateway != nil {
			status.ObservedGeneration = projection.gateway.GetGeneration()
			createdAt := projection.gateway.GetCreationTimestamp()
			if !createdAt.Time.IsZero() {
				status.LastSyncedAt = timestamppb.New(createdAt.Time)
			}
		}
		return status
	}
	if projection.gateway == nil {
		status.Reason = "Waiting for Gateway/" + gatewayName
		return status
	}
	if len(projection.targets) == 0 {
		status.Reason = "Waiting for managed Istio egress routes"
		return status
	}
	if reason := falseConditionReason(projection.resources); reason != "" {
		status.Phase = egressv1.EgressSyncPhase_EGRESS_SYNC_PHASE_FAILED
		status.Reason = reason
		return status
	}
	if reason := pendingConditionReason(projection.resources); reason != "" {
		status.Reason = reason
		return status
	}
	status.Phase = egressv1.EgressSyncPhase_EGRESS_SYNC_PHASE_SYNCED
	status.Reason = "Istio egress resources are programmed"
	status.ObservedGeneration = projection.gateway.GetGeneration()
	createdAt := projection.gateway.GetCreationTimestamp()
	if !createdAt.Time.IsZero() {
		status.LastSyncedAt = timestamppb.New(createdAt.Time)
	}
	return status
}

func policyHasManagedTargets(policy *egressv1.EgressPolicy) bool {
	// custom_rules are matched at runtime and are not rendered into Istio resources.
	_ = policy
	return false
}

func falseConditionReason(resources []*unstructured.Unstructured) string {
	for _, resource := range resources {
		for _, condition := range interestingConditions(resource) {
			if conditionString(condition, "status") != "False" {
				continue
			}
			if isPendingFalseCondition(resource, condition) {
				continue
			}
			return conditionReason(resource, condition, "failed")
		}
	}
	return ""
}

func isPendingFalseCondition(_ *unstructured.Unstructured, _ map[string]any) bool {
	return false
}

func pendingConditionReason(resources []*unstructured.Unstructured) string {
	for _, resource := range resources {
		seen := map[string]struct{}{}
		for _, condition := range interestingConditions(resource) {
			conditionType := conditionString(condition, "type")
			seen[conditionType] = struct{}{}
			if conditionString(condition, "status") != "True" {
				return conditionReason(resource, condition, "pending")
			}
		}
		for _, conditionType := range expectedConditions(resource) {
			if _, ok := seen[conditionType]; !ok {
				return fmt.Sprintf("%s %s %s pending", resource.GetKind(), resource.GetName(), conditionType)
			}
		}
	}
	return ""
}

func conditionReason(resource *unstructured.Unstructured, condition map[string]any, state string) string {
	conditionType := conditionString(condition, "type")
	message := conditionString(condition, "message")
	if message != "" {
		return fmt.Sprintf("%s %s %s %s: %s", resource.GetKind(), resource.GetName(), conditionType, state, message)
	}
	reason := conditionString(condition, "reason")
	if reason == "" {
		reason = strings.ToLower(state)
	}
	return fmt.Sprintf("%s %s %s %s: %s", resource.GetKind(), resource.GetName(), conditionType, state, reason)
}
