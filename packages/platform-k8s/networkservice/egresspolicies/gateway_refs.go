package egresspolicies

import (
	egressv1 "code-code.internal/go-contract/egress/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

func appliedResources(projection gatewayProjection) []*egressv1.EgressResourceRef {
	out := make([]*egressv1.EgressResourceRef, 0, len(projection.resources))
	for _, resource := range projection.resources {
		if resource == nil || resource.GetName() == gatewayName {
			continue
		}
		out = append(out, resourceRef(resource))
	}
	return out
}

func resourceRef(resource *unstructured.Unstructured) *egressv1.EgressResourceRef {
	return &egressv1.EgressResourceRef{
		Kind:      resource.GetKind(),
		Namespace: resource.GetNamespace(),
		Name:      resource.GetName(),
	}
}
