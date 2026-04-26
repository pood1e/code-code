package egresspolicies

import "sigs.k8s.io/controller-runtime/pkg/client"

func desiredGatewayObjects(
	namespace string,
	runtime gatewayRuntime,
	targets []egressTarget,
	proxies []egressProxyAddress,
) []client.Object {
	proxyByID := proxyAddressByID(proxies)
	objects := make([]client.Object, 0, len(targets)*3+len(proxies)+2)
	objects = append(objects, sharedGateway(runtime, targets))
	objects = append(objects, egressGatewayDestinationRule(namespace, runtime, targets))
	for _, proxy := range proxies {
		objects = append(objects, proxyServiceEntry(runtime.namespace, proxy))
	}
	objects = append(objects, proxyDestinationRules(runtime.namespace, targets, proxyByID)...)
	for _, target := range targets {
		objects = append(objects, targetServiceEntry(namespace, target))
		objects = append(objects, targetVirtualService(namespace, runtime, target, proxyByID))
		objects = append(objects, targetGatewayVirtualService(runtime, target, proxyByID))
	}
	return objects
}

func proxyAddressByID(proxies []egressProxyAddress) map[string]egressProxyAddress {
	out := map[string]egressProxyAddress{}
	for _, proxy := range proxies {
		out[proxy.proxyID] = proxy
	}
	return out
}
