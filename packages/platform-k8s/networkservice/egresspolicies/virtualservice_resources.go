package egresspolicies

import (
	istionetworking "istio.io/api/networking/v1alpha3"
	istionetworkingv1 "istio.io/client-go/pkg/apis/networking/v1"
)

func targetVirtualService(
	namespace string,
	runtime gatewayRuntime,
	target egressTarget,
	proxyByID map[string]egressProxyAddress,
) *istionetworkingv1.VirtualService {
	virtualService := &istionetworkingv1.VirtualService{
		TypeMeta:   istioTypeMeta(virtualServiceGVK.Kind),
		ObjectMeta: istioObjectMeta(namespace, target.routeName, targetLabels(target), targetAnnotations(target)),
	}
	virtualService.Spec.Hosts = []string{target.hostname}
	virtualService.Spec.Gateways = []string{"mesh"}
	virtualService.Spec.Tls = []*istionetworking.TLSRoute{{
		Match: []*istionetworking.TLSMatchAttributes{typedTLSMatch("mesh", target.hostname)},
		Route: []*istionetworking.RouteDestination{{Destination: typedEgressGatewayDestination(runtime, target)}},
	}}
	return virtualService
}

func targetGatewayVirtualService(
	runtime gatewayRuntime,
	target egressTarget,
	proxyByID map[string]egressProxyAddress,
) *istionetworkingv1.VirtualService {
	virtualService := &istionetworkingv1.VirtualService{
		TypeMeta: istioTypeMeta(virtualServiceGVK.Kind),
		ObjectMeta: istioObjectMeta(
			runtime.namespace,
			target.routeName,
			targetLabels(target),
			targetAnnotations(target),
		),
	}
	virtualService.Spec.Hosts = []string{target.hostname}
	virtualService.Spec.Gateways = []string{gatewayName}
	virtualService.Spec.Tls = []*istionetworking.TLSRoute{{
		Match: []*istionetworking.TLSMatchAttributes{typedTLSMatch(gatewayName, target.hostname)},
		Route: []*istionetworking.RouteDestination{{
			Destination: typedExternalDestination(target, proxyByID),
		}},
	}}
	return virtualService
}

func typedEgressGatewayDestination(runtime gatewayRuntime, target egressTarget) *istionetworking.Destination {
	return &istionetworking.Destination{
		Host:   runtime.serviceHost,
		Subset: targetSubsetName(target),
		Port:   &istionetworking.PortSelector{Number: 443},
	}
}

func typedExternalDestination(target egressTarget, proxyByID map[string]egressProxyAddress) *istionetworking.Destination {
	proxy, ok := proxyByID[target.proxyID]
	if target.action != egressActionProxy || !ok {
		return typedTargetDestination(target)
	}
	return &istionetworking.Destination{
		Host:   proxyServiceHost(proxy),
		Subset: targetSubsetName(target),
		Port:   &istionetworking.PortSelector{Number: uint32(proxy.port)},
	}
}

func typedTargetDestination(target egressTarget) *istionetworking.Destination {
	return &istionetworking.Destination{
		Host: target.hostname,
		Port: &istionetworking.PortSelector{Number: 443},
	}
}

func typedTLSMatch(gateway string, hostname string) *istionetworking.TLSMatchAttributes {
	return &istionetworking.TLSMatchAttributes{
		Gateways: []string{gateway},
		Port:     443,
		SniHosts: []string{hostname},
	}
}
