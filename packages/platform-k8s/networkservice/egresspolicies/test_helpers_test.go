package egresspolicies

import (
	"code-code.internal/platform-k8s/internal/testutil"
	istionetworkingv1 "istio.io/client-go/pkg/apis/networking/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
)

func gatewayTestScheme() *runtime.Scheme {
	scheme := testutil.NewScheme()
	_ = istionetworkingv1.AddToScheme(scheme)
	return scheme
}

func gatewayStub(namespace string) *unstructured.Unstructured {
	return gatewayObject(gatewayGVK, namespace, gatewayName, map[string]any{}, nil, nil)
}

func httpsTransparentRouteStubFor(namespace string, hostnames []string) *istionetworkingv1.VirtualService {
	return targetVirtualService(namespace, testGatewayRuntime(), testEndpoint(hostnames[0]), nil)
}

func testGatewayRuntime() gatewayRuntime {
	return gatewayRuntime{
		namespace:   "code-code-net",
		serviceHost: "code-code-egressgateway.code-code-net.svc.cluster.local",
		selector:    "code-code-egressgateway",
	}
}

func testEndpoint(hostname string) egressTarget {
	name := targetResourceName(hostname)
	return egressTarget{
		hostname:         hostname,
		serviceEntryName: name,
		routeName:        name,
		source:           egressSourceRuleSet,
		ruleSetID:        "vendor.test",
		action:           egressActionDirect,
	}
}
