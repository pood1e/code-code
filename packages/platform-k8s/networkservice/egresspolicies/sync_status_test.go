package egresspolicies

import (
	"testing"

	egressv1 "code-code.internal/go-contract/egress/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

func TestSyncStatusDoesNotRequireIstioGatewayConditions(t *testing.T) {
	gateway := gatewayStub("code-code-net")
	status := syncStatus(&egressv1.EgressPolicy{
		CustomRules: []*egressv1.EgressRule{{
			RuleId: "api-mistral",
			Match:  &egressv1.EgressRuleMatch{Kind: &egressv1.EgressRuleMatch_HostExact{HostExact: "api.mistral.ai"}},
		}},
	}, "code-code-net", gatewayProjection{
		gateway:   gateway,
		targets:   []egressTarget{testEndpoint("api.mistral.ai")},
		resources: []*unstructured.Unstructured{gateway},
	})
	if status.GetPhase() != egressv1.EgressSyncPhase_EGRESS_SYNC_PHASE_SYNCED {
		t.Fatalf("phase = %s, want synced; reason=%s", status.GetPhase(), status.GetReason())
	}
}

func TestSyncStatusIsSyncedWithoutTargetsWhenOnlyCustomRulesExist(t *testing.T) {
	gateway := gatewayStub("code-code-net")
	status := syncStatus(&egressv1.EgressPolicy{
		CustomRules: []*egressv1.EgressRule{{
			RuleId: "api-openai",
			Match:  &egressv1.EgressRuleMatch{Kind: &egressv1.EgressRuleMatch_HostExact{HostExact: "api.openai.com"}},
		}},
	}, "code-code-net", gatewayProjection{
		gateway:   gateway,
		resources: []*unstructured.Unstructured{gateway},
	})
	if status.GetPhase() != egressv1.EgressSyncPhase_EGRESS_SYNC_PHASE_SYNCED {
		t.Fatalf("phase = %s, want synced", status.GetPhase())
	}
}

func TestSyncStatusIsSyncedWithoutTargetsWhenPolicyHasNoCustomRules(t *testing.T) {
	gateway := gatewayStub("code-code-net")
	status := syncStatus(&egressv1.EgressPolicy{}, "code-code-net", gatewayProjection{
		gateway:   gateway,
		resources: []*unstructured.Unstructured{gateway},
	})
	if status.GetPhase() != egressv1.EgressSyncPhase_EGRESS_SYNC_PHASE_SYNCED {
		t.Fatalf("phase = %s, want synced", status.GetPhase())
	}
}
