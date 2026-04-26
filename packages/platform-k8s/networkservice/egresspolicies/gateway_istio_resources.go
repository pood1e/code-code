package egresspolicies

import (
	istionetworking "istio.io/api/networking/v1alpha3"
	istionetworkingv1 "istio.io/client-go/pkg/apis/networking/v1"
)

func sharedGateway(runtime gatewayRuntime, targets []egressTarget) *istionetworkingv1.Gateway {
	gateway := &istionetworkingv1.Gateway{
		TypeMeta:   istioTypeMeta(gatewayGVK.Kind),
		ObjectMeta: istioObjectMeta(runtime.namespace, gatewayName, nil, nil),
	}
	gateway.Spec.Selector = map[string]string{"istio": runtime.selector}
	if hosts := targetHosts(targets); len(hosts) > 0 {
		gateway.Spec.Servers = append(gateway.Spec.Servers, &istionetworking.Server{
			Port:  &istionetworking.Port{Number: 443, Name: "tls-passthrough", Protocol: "TLS"},
			Tls:   &istionetworking.ServerTLSSettings{Mode: istionetworking.ServerTLSSettings_PASSTHROUGH},
			Hosts: hosts,
		})
	}
	return gateway
}

func targetHosts(targets []egressTarget) []string {
	hosts := make([]string, 0, len(targets))
	for _, target := range targets {
		hosts = append(hosts, target.hostname)
	}
	return hosts
}
