package egresspolicies

import (
	"context"
	"testing"

	egressv1 "code-code.internal/go-contract/egress/v1"
)

func TestDesiredStateFromPolicyCustomRulesAreNotMaterializedToIstioTargets(t *testing.T) {
	desired, _, err := desiredStateFromPolicy(context.Background(), &egressv1.EgressPolicy{
		PolicyId:    policyID,
		DisplayName: policyDisplayName,
		Proxies: []*egressv1.EgressProxy{{
			ProxyId:     presetProxyID,
			DisplayName: presetProxyName,
			Protocol:    egressv1.EgressProxyProtocol_EGRESS_PROXY_PROTOCOL_HTTP,
			Url:         presetProxyURL,
		}},
		CustomRules: []*egressv1.EgressRule{{
			RuleId: "custom-exact",
			Match: &egressv1.EgressRuleMatch{
				Kind: &egressv1.EgressRuleMatch_HostExact{HostExact: "api.openai.com"},
			},
			Action:  egressv1.EgressAction_EGRESS_ACTION_PROXY,
			ProxyId: presetProxyID,
		}},
	}, gatewayProjection{}, &recordingExternalRuleSetLoader{})
	if err != nil {
		t.Fatalf("desiredStateFromPolicy() error = %v", err)
	}
	if len(desired.targets) != 0 {
		t.Fatalf("managed targets = %d, want 0", len(desired.targets))
	}
}

func TestDesiredStateFromPolicyLoadsExternalRuleSetThroughConfiguredProxy(t *testing.T) {
	loader := recordingExternalRuleSetLoader{
		hosts: []string{"api.openai.com"},
	}
	_, status, err := desiredStateFromPolicy(context.Background(), &egressv1.EgressPolicy{
		PolicyId:    policyID,
		DisplayName: policyDisplayName,
		Proxies: []*egressv1.EgressProxy{{
			ProxyId:     presetProxyID,
			DisplayName: presetProxyName,
			Protocol:    egressv1.EgressProxyProtocol_EGRESS_PROXY_PROTOCOL_HTTP,
			Url:         presetProxyURL,
		}},
		ExternalRuleSet: &egressv1.EgressExternalRuleSet{
			SourceUrl: "https://example.com/autoproxy.txt",
			Enabled:   true,
			Action:    egressv1.EgressAction_EGRESS_ACTION_PROXY,
			ProxyId:   presetProxyID,
		},
	}, gatewayProjection{}, &loader)
	if err != nil {
		t.Fatalf("desiredStateFromPolicy() error = %v", err)
	}
	if loader.proxyURL != presetProxyURL {
		t.Fatalf("loader proxy URL = %q, want %q", loader.proxyURL, presetProxyURL)
	}
	if status.GetLoadedHostCount() != 1 {
		t.Fatalf("loaded hosts = %d, want 1", status.GetLoadedHostCount())
	}
}

type recordingExternalRuleSetLoader struct {
	hosts     []string
	sourceURL string
	proxyURL  string
}

func (l *recordingExternalRuleSetLoader) Load(_ context.Context, sourceURL string, proxyURL string) (externalRuleSetLoad, error) {
	l.sourceURL = sourceURL
	l.proxyURL = proxyURL
	return externalRuleSetLoad{hosts: l.hosts}, nil
}
