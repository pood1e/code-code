package egresspolicies

import (
	"context"
	"fmt"
	"testing"

	egressv1 "code-code.internal/go-contract/egress/v1"
	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/types"
	ctrlclient "sigs.k8s.io/controller-runtime/pkg/client"
	ctrlclientfake "sigs.k8s.io/controller-runtime/pkg/client/fake"
)

func TestServiceListProjectsGatewayResources(t *testing.T) {
	const namespace = "code-code"
	runtime := testGatewayRuntime()
	proxy := egressProxyAddress{proxyID: "preset-proxy", displayName: "Preset HTTP Proxy", address: "proxy.local", port: 10809}
	target := testEndpoint("oauth2.googleapis.com")
	target.ruleSetID = externalRuleSetID
	target.displayName = externalRuleSetDisplayName
	target.sourceURL = "https://example.com/autoproxy.txt"
	target.action = egressActionProxy
	target.proxyID = proxy.proxyID
	client := ctrlclientfake.NewClientBuilder().
		WithScheme(gatewayTestScheme()).
		WithRuntimeObjects(
			egressPolicyConfigMap(namespace, &egressv1.EgressPolicy{
				PolicyId:    policyID,
				DisplayName: policyDisplayName,
				Proxies: []*egressv1.EgressProxy{{
					ProxyId:     proxy.proxyID,
					DisplayName: proxy.displayName,
					Protocol:    egressv1.EgressProxyProtocol_EGRESS_PROXY_PROTOCOL_HTTP,
					Url:         proxyURL(proxy),
				}},
				ExternalRuleSet: &egressv1.EgressExternalRuleSet{
					SourceUrl: "https://example.com/autoproxy.txt",
					Enabled:   true,
					Action:    egressv1.EgressAction_EGRESS_ACTION_PROXY,
					ProxyId:   proxy.proxyID,
				},
			}, &egressv1.EgressExternalRuleSetStatus{
				Phase:            egressv1.EgressExternalRuleSetLoadPhase_EGRESS_EXTERNAL_RULE_SET_LOAD_PHASE_LOADED,
				SourceUrl:        "https://example.com/autoproxy.txt",
				LoadedHostCount:  27,
				SkippedRuleCount: 3,
				Message:          "AutoProxy rule set loaded into proxy-side matcher",
			}),
			sharedGateway(runtime, []egressTarget{target}),
			egressGatewayDestinationRule(namespace, runtime, []egressTarget{target}),
			proxyServiceEntry(runtime.namespace, proxy),
			targetServiceEntry(namespace, target),
			targetVirtualService(namespace, runtime, target, map[string]egressProxyAddress{proxy.proxyID: proxy}),
		).
		Build()
	service, err := NewService(ServiceConfig{
		Client:         client,
		Reader:         client,
		Namespace:      namespace,
		GatewayRuntime: GatewayRuntimeConfig{Namespace: runtime.namespace, ServiceHost: runtime.serviceHost, Selector: runtime.selector},
	})
	if err != nil {
		t.Fatalf("NewService() error = %v", err)
	}

	items, err := service.List(context.Background())
	if err != nil {
		t.Fatalf("List() error = %v", err)
	}
	policy := items[0].GetPolicy()
	if len(policy.GetProxies()) != 1 || policy.GetProxies()[0].GetProxyId() != "preset-proxy" {
		t.Fatalf("proxies = %+v", policy.GetProxies())
	}
	if policy.GetExternalRuleSet().GetSourceUrl() != "https://example.com/autoproxy.txt" {
		t.Fatalf("external ruleset = %+v", policy.GetExternalRuleSet())
	}
	if policy.GetExternalRuleSet().GetAction() != egressv1.EgressAction_EGRESS_ACTION_PROXY {
		t.Fatalf("external ruleset action = %s", policy.GetExternalRuleSet().GetAction())
	}
	if items[0].GetExternalRuleSetStatus().GetLoadedHostCount() != 27 {
		t.Fatalf("external ruleset loaded hosts = %d, want 27", items[0].GetExternalRuleSetStatus().GetLoadedHostCount())
	}
}

func TestServiceUpdateCustomRulesDoNotMaterializeIstioResources(t *testing.T) {
	const namespace = "code-code"
	runtime := testGatewayRuntime()
	client := ctrlclientfake.NewClientBuilder().
		WithScheme(gatewayTestScheme()).
		Build()
	service, err := NewService(ServiceConfig{
		Client:         client,
		Reader:         client,
		Namespace:      namespace,
		GatewayRuntime: GatewayRuntimeConfig{Namespace: runtime.namespace, ServiceHost: runtime.serviceHost, Selector: runtime.selector},
	})
	if err != nil {
		t.Fatalf("NewService() error = %v", err)
	}
	service.externalRules = staticExternalRuleSetLoader{hosts: []string{"oauth2.googleapis.com"}}

	item, err := service.Update(context.Background(), &egressv1.EgressPolicy{
		Proxies: []*egressv1.EgressProxy{{
			ProxyId:     "preset-proxy",
			DisplayName: "Preset HTTP Proxy",
			Protocol:    egressv1.EgressProxyProtocol_EGRESS_PROXY_PROTOCOL_HTTP,
			Url:         "http://127.0.0.1:10809",
		}},
		CustomRules: []*egressv1.EgressRule{{
			RuleId:  "google-oauth",
			Match:   &egressv1.EgressRuleMatch{Kind: &egressv1.EgressRuleMatch_HostExact{HostExact: "oauth2.googleapis.com"}},
			Action:  egressv1.EgressAction_EGRESS_ACTION_PROXY,
			ProxyId: "preset-proxy",
		}},
		ExternalRuleSet: &egressv1.EgressExternalRuleSet{
			SourceUrl: "https://example.com/autoproxy.txt",
			Enabled:   true,
			Action:    egressv1.EgressAction_EGRESS_ACTION_PROXY,
			ProxyId:   "preset-proxy",
		},
	})
	if err != nil {
		t.Fatalf("Update() error = %v", err)
	}
	if item.GetSync().GetPhase() != egressv1.EgressSyncPhase_EGRESS_SYNC_PHASE_SYNCED {
		t.Fatalf("sync phase = %s, want synced", item.GetSync().GetPhase())
	}
	if item.GetExternalRuleSetStatus().GetLoadedHostCount() != 1 {
		t.Fatalf("external ruleset loaded hosts = %d, want 1", item.GetExternalRuleSetStatus().GetLoadedHostCount())
	}

	serviceEntry := &unstructured.Unstructured{}
	serviceEntry.SetGroupVersionKind(serviceEntryGVK)
	if err := client.Get(
		context.Background(),
		types.NamespacedName{Namespace: runtime.namespace, Name: proxyResourceName("preset-proxy")},
		serviceEntry,
	); !apierrors.IsNotFound(err) {
		t.Fatalf("proxy ServiceEntry should be absent, got err=%v", err)
	}
	destinationRule := &unstructured.Unstructured{}
	destinationRule.SetGroupVersionKind(destinationRuleGVK)
	if err := client.Get(
		context.Background(),
		types.NamespacedName{Namespace: runtime.namespace, Name: proxyResourceName("preset-proxy")},
		destinationRule,
	); !apierrors.IsNotFound(err) {
		t.Fatalf("proxy DestinationRule should be absent, got err=%v", err)
	}
	gateway := &unstructured.Unstructured{}
	gateway.SetGroupVersionKind(gatewayGVK)
	if err := client.Get(context.Background(), types.NamespacedName{Namespace: runtime.namespace, Name: gatewayName}, gateway); !apierrors.IsNotFound(err) {
		t.Fatalf("egress Gateway should be absent, got err=%v", err)
	}
	targetEntry := &unstructured.Unstructured{}
	targetEntry.SetGroupVersionKind(serviceEntryGVK)
	if err := client.Get(context.Background(), types.NamespacedName{Namespace: namespace, Name: targetResourceName("oauth2.googleapis.com")}, targetEntry); !apierrors.IsNotFound(err) {
		t.Fatalf("target ServiceEntry should be absent, got err=%v", err)
	}
}

func TestServiceUpdateExternalRuleSetLoadsWithoutIstioTargets(t *testing.T) {
	const namespace = "code-code"
	runtime := testGatewayRuntime()
	client := ctrlclientfake.NewClientBuilder().
		WithScheme(gatewayTestScheme()).
		Build()
	service, err := NewService(ServiceConfig{
		Client:         client,
		Reader:         client,
		Namespace:      namespace,
		GatewayRuntime: GatewayRuntimeConfig{Namespace: runtime.namespace, ServiceHost: runtime.serviceHost, Selector: runtime.selector},
	})
	if err != nil {
		t.Fatalf("NewService() error = %v", err)
	}
	service.externalRules = staticExternalRuleSetLoader{hosts: []string{"api.openai.com", "oauth2.googleapis.com"}}

	item, err := service.Update(context.Background(), &egressv1.EgressPolicy{
		Proxies: []*egressv1.EgressProxy{{
			ProxyId:     "preset-proxy",
			DisplayName: "Preset HTTP Proxy",
			Protocol:    egressv1.EgressProxyProtocol_EGRESS_PROXY_PROTOCOL_HTTP,
			Url:         "http://127.0.0.1:10809",
		}},
		ExternalRuleSet: &egressv1.EgressExternalRuleSet{
			SourceUrl: "https://example.com/autoproxy.txt",
			Enabled:   true,
			Action:    egressv1.EgressAction_EGRESS_ACTION_PROXY,
			ProxyId:   "preset-proxy",
		},
	})
	if err != nil {
		t.Fatalf("Update() error = %v", err)
	}
	if item.GetExternalRuleSetStatus().GetLoadedHostCount() != 2 {
		t.Fatalf("external ruleset loaded hosts = %d, want 2", item.GetExternalRuleSetStatus().GetLoadedHostCount())
	}
	if item.GetSync().GetPhase() != egressv1.EgressSyncPhase_EGRESS_SYNC_PHASE_SYNCED {
		t.Fatalf("sync phase = %s, want synced", item.GetSync().GetPhase())
	}
	list := &unstructured.UnstructuredList{}
	list.SetGroupVersionKind(serviceEntryListGVK)
	if err := client.List(context.Background(), list, ctrlclient.InNamespace(namespace)); err != nil {
		t.Fatalf("list ServiceEntry: %v", err)
	}
	for i := range list.Items {
		role := list.Items[i].GetLabels()[labelEgressRole]
		if role == egressRoleTarget {
			t.Fatalf("unexpected target ServiceEntry %s when only external rule set is enabled", list.Items[i].GetName())
		}
	}
	proxyEntry := &unstructured.Unstructured{}
	proxyEntry.SetGroupVersionKind(serviceEntryGVK)
	if err := client.Get(context.Background(), types.NamespacedName{Namespace: runtime.namespace, Name: proxyResourceName("preset-proxy")}, proxyEntry); !apierrors.IsNotFound(err) {
		t.Fatalf("proxy ServiceEntry should be absent, got err=%v", err)
	}
}

func TestServiceUpdateKeepsPolicyWhenExternalRuleSetLoadFails(t *testing.T) {
	const namespace = "code-code"
	runtime := testGatewayRuntime()
	client := ctrlclientfake.NewClientBuilder().
		WithScheme(gatewayTestScheme()).
		Build()
	service, err := NewService(ServiceConfig{
		Client:         client,
		Reader:         client,
		Namespace:      namespace,
		GatewayRuntime: GatewayRuntimeConfig{Namespace: runtime.namespace, ServiceHost: runtime.serviceHost, Selector: runtime.selector},
	})
	if err != nil {
		t.Fatalf("NewService() error = %v", err)
	}
	service.externalRules = failingExternalRuleSetLoader{err: fmt.Errorf("load AutoProxy rule set: timeout")}

	item, err := service.Update(context.Background(), &egressv1.EgressPolicy{
		Proxies: []*egressv1.EgressProxy{{
			ProxyId:     "preset-proxy",
			DisplayName: "Preset HTTP Proxy",
			Protocol:    egressv1.EgressProxyProtocol_EGRESS_PROXY_PROTOCOL_HTTP,
			Url:         "http://127.0.0.1:10809",
		}},
		ExternalRuleSet: &egressv1.EgressExternalRuleSet{
			SourceUrl: "https://example.com/autoproxy.txt",
			Enabled:   true,
			Action:    egressv1.EgressAction_EGRESS_ACTION_DIRECT,
		},
	})
	if err != nil {
		t.Fatalf("Update() error = %v", err)
	}
	if item.GetExternalRuleSetStatus().GetPhase() != egressv1.EgressExternalRuleSetLoadPhase_EGRESS_EXTERNAL_RULE_SET_LOAD_PHASE_FAILED {
		t.Fatalf("external rule set phase = %s", item.GetExternalRuleSetStatus().GetPhase())
	}
	if item.GetExternalRuleSetStatus().GetMessage() == "" {
		t.Fatalf("external rule set failure message is empty")
	}
	if item.GetPolicy().GetExternalRuleSet().GetEnabled() != true {
		t.Fatalf("external rule set config was not persisted")
	}
}

type staticExternalRuleSetLoader struct {
	hosts []string
}

func (l staticExternalRuleSetLoader) Load(context.Context, string, string) (externalRuleSetLoad, error) {
	return externalRuleSetLoad{hosts: l.hosts}, nil
}

type failingExternalRuleSetLoader struct {
	err error
}

func (l failingExternalRuleSetLoader) Load(context.Context, string, string) (externalRuleSetLoad, error) {
	return externalRuleSetLoad{}, l.err
}

func egressPolicyConfigMap(
	namespace string,
	policy *egressv1.EgressPolicy,
	status *egressv1.EgressExternalRuleSetStatus,
) *corev1.ConfigMap {
	payload, err := policyJSON.Marshal(policy)
	if err != nil {
		panic(err)
	}
	data := map[string]string{policyConfigKey: string(payload)}
	if status != nil {
		statusPayload, statusErr := policyJSON.Marshal(status)
		if statusErr != nil {
			panic(statusErr)
		}
		data[policyExternalStatusKey] = string(statusPayload)
	}
	return &corev1.ConfigMap{
		ObjectMeta: metav1.ObjectMeta{
			Namespace: namespace,
			Name:      policyConfigMapName,
			Labels:    mergeStringMaps(gatewayLabels(), map[string]string{labelEgressRole: egressRolePolicy}),
		},
		Data: data,
	}
}
