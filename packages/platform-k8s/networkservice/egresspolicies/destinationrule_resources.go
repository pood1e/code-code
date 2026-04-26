package egresspolicies

import (
	istionetworking "istio.io/api/networking/v1alpha3"
	istionetworkingv1 "istio.io/client-go/pkg/apis/networking/v1"
)

func egressGatewayDestinationRule(namespace string, runtime gatewayRuntime, targets []egressTarget) *istionetworkingv1.DestinationRule {
	destinationRule := &istionetworkingv1.DestinationRule{
		TypeMeta:   istioTypeMeta(destinationRuleGVK.Kind),
		ObjectMeta: istioObjectMeta(namespace, egressGatewayRuleName, gatewayResourceLabels(), nil),
	}
	destinationRule.Spec.Host = runtime.serviceHost
	destinationRule.Spec.Subsets = make([]*istionetworking.Subset, 0, len(targets))
	for _, target := range targets {
		destinationRule.Spec.Subsets = append(destinationRule.Spec.Subsets, &istionetworking.Subset{
			Name:   targetSubsetName(target),
			Labels: map[string]string{"istio": runtime.selector},
		})
	}
	return destinationRule
}

func proxyDestinationRule(namespace string, proxy egressProxyAddress, targets []egressTarget) *istionetworkingv1.DestinationRule {
	destinationRule := &istionetworkingv1.DestinationRule{
		TypeMeta:   istioTypeMeta(destinationRuleGVK.Kind),
		ObjectMeta: istioObjectMeta(namespace, proxyResourceName(proxy.proxyID), proxyLabels(proxy), proxyAnnotations(proxy)),
	}
	destinationRule.Spec.Host = proxyServiceHost(proxy)
	destinationRule.Spec.Subsets = make([]*istionetworking.Subset, 0, len(targets))
	for _, target := range targets {
		destinationRule.Spec.Subsets = append(destinationRule.Spec.Subsets, &istionetworking.Subset{
			Name:   targetSubsetName(target),
			Labels: map[string]string{labelEgressProxyID: proxy.proxyID},
			TrafficPolicy: &istionetworking.TrafficPolicy{
				Tunnel: &istionetworking.TrafficPolicy_TunnelSettings{
					Protocol:   "CONNECT",
					TargetHost: target.hostname,
					TargetPort: 443,
				},
			},
		})
	}
	return destinationRule
}
