package egresspolicies

import (
	"fmt"

	istionetworking "istio.io/api/networking/v1alpha3"
	istionetworkingv1 "istio.io/client-go/pkg/apis/networking/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
)

type projectedRoutePolicy struct {
	action string
}

func routePolicyFromSpec(virtualService *istionetworkingv1.VirtualService, gatewayNamespace string, targetHost string) (projectedRoutePolicy, error) {
	gatewayRef := gatewayNamespace + "/" + gatewayName
	if host := tlsRouteDestinationHost(virtualService, gatewayRef); host != "" {
		return projectedRoutePolicy{action: actionForTargetHost(host, targetHost)}, nil
	}
	return projectedRoutePolicy{}, fmt.Errorf("VirtualService has no route for %s", gatewayRef)
}

func typedVirtualService(route *unstructured.Unstructured) (*istionetworkingv1.VirtualService, error) {
	virtualService := &istionetworkingv1.VirtualService{}
	if err := runtime.DefaultUnstructuredConverter.FromUnstructured(route.Object, virtualService); err != nil {
		return nil, fmt.Errorf("decode Istio VirtualService: %w", err)
	}
	return virtualService, nil
}

func actionForTargetHost(destinationHost string, targetHost string) string {
	if normalizeHostname(destinationHost) != normalizeHostname(targetHost) {
		return egressActionProxy
	}
	return egressActionDirect
}

func tlsRouteDestinationHost(route *istionetworkingv1.VirtualService, gatewayRef string) string {
	for _, item := range route.Spec.GetTls() {
		if item != nil && tlsRouteMatchesGateway(item, gatewayRef) {
			return firstTLSDestinationHost(item)
		}
	}
	return ""
}

func tlsRouteMatchesGateway(route *istionetworking.TLSRoute, gatewayRef string) bool {
	for _, match := range route.GetMatch() {
		if stringListContains(match.GetGateways(), gatewayRef) {
			return true
		}
	}
	return false
}

func firstTLSDestinationHost(route *istionetworking.TLSRoute) string {
	for _, item := range route.GetRoute() {
		if item.GetDestination() != nil {
			return item.GetDestination().GetHost()
		}
	}
	return ""
}

func stringListContains(items []string, want string) bool {
	for _, item := range items {
		if item == want {
			return true
		}
	}
	return false
}
