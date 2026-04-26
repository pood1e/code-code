package egresspolicies

import (
	"fmt"
	"strings"

	istionetworking "istio.io/api/networking/v1alpha3"
	istionetworkingv1 "istio.io/client-go/pkg/apis/networking/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
)

func proxyFromServiceEntry(serviceEntry *unstructured.Unstructured) (egressProxyAddress, bool, error) {
	labels := serviceEntry.GetLabels()
	if labels[labelEgressRole] != egressRoleProxy {
		return egressProxyAddress{}, false, nil
	}
	proxyID := strings.TrimSpace(labels[labelEgressProxyID])
	if proxyID == "" {
		return egressProxyAddress{}, false, fmt.Errorf("proxy ServiceEntry %s has no proxy id", serviceEntry.GetName())
	}
	typed, err := typedServiceEntry(serviceEntry)
	if err != nil {
		return egressProxyAddress{}, false, fmt.Errorf("proxy ServiceEntry %s: %w", serviceEntry.GetName(), err)
	}
	if len(typed.Spec.GetEndpoints()) == 0 {
		return egressProxyAddress{}, false, fmt.Errorf("proxy ServiceEntry %s has no target", serviceEntry.GetName())
	}
	address, port, err := serviceEntryTargetAddress(typed.Spec.GetEndpoints()[0])
	if err != nil {
		return egressProxyAddress{}, false, fmt.Errorf("proxy ServiceEntry %s: %w", serviceEntry.GetName(), err)
	}
	return egressProxyAddress{
		proxyID:     proxyID,
		displayName: serviceEntry.GetAnnotations()[annotationDisplayName],
		address:     address,
		port:        port,
	}, true, nil
}

func typedServiceEntry(serviceEntry *unstructured.Unstructured) (*istionetworkingv1.ServiceEntry, error) {
	typed := &istionetworkingv1.ServiceEntry{}
	if err := runtime.DefaultUnstructuredConverter.FromUnstructured(serviceEntry.Object, typed); err != nil {
		return nil, fmt.Errorf("decode Istio ServiceEntry: %w", err)
	}
	return typed, nil
}

func serviceEntryTargetAddress(target *istionetworking.WorkloadEntry) (string, int64, error) {
	if target == nil {
		return "", 0, fmt.Errorf("target is empty")
	}
	address := target.GetAddress()
	port, ok := target.GetPorts()["http"]
	if !ok {
		return "", 0, fmt.Errorf("target http port is missing")
	}
	if strings.TrimSpace(address) == "" {
		return "", 0, fmt.Errorf("target address is empty")
	}
	return strings.TrimSpace(address), int64(port), nil
}
