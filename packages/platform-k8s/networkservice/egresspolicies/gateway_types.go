package egresspolicies

import "k8s.io/apimachinery/pkg/runtime/schema"

const (
	gatewayName           = "code-code-egress"
	egressGatewayRuleName = "code-code-egressgateway"
	policyID              = "code-code-egress"
	policyDisplayName     = "Istio Ambient Egress"
	fieldOwner            = "platform-network-service"
)

var (
	gatewayGVK = schema.GroupVersionKind{
		Group:   "networking.istio.io",
		Version: "v1",
		Kind:    "Gateway",
	}
	virtualServiceGVK = schema.GroupVersionKind{
		Group:   "networking.istio.io",
		Version: "v1",
		Kind:    "VirtualService",
	}
	virtualServiceListGVK = schema.GroupVersionKind{
		Group:   "networking.istio.io",
		Version: "v1",
		Kind:    "VirtualServiceList",
	}
	serviceEntryGVK = schema.GroupVersionKind{
		Group:   "networking.istio.io",
		Version: "v1",
		Kind:    "ServiceEntry",
	}
	serviceEntryListGVK = schema.GroupVersionKind{
		Group:   "networking.istio.io",
		Version: "v1",
		Kind:    "ServiceEntryList",
	}
	destinationRuleGVK = schema.GroupVersionKind{
		Group:   "networking.istio.io",
		Version: "v1",
		Kind:    "DestinationRule",
	}
	destinationRuleListGVK = schema.GroupVersionKind{
		Group:   "networking.istio.io",
		Version: "v1",
		Kind:    "DestinationRuleList",
	}
)
