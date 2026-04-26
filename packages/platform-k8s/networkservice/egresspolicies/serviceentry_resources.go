package egresspolicies

import (
	"strings"

	istionetworking "istio.io/api/networking/v1alpha3"
	istionetworkingv1 "istio.io/client-go/pkg/apis/networking/v1"
)

func targetServiceEntry(namespace string, target egressTarget) *istionetworkingv1.ServiceEntry {
	serviceEntry := &istionetworkingv1.ServiceEntry{
		TypeMeta:   istioTypeMeta(serviceEntryGVK.Kind),
		ObjectMeta: istioObjectMeta(namespace, target.serviceEntryName, targetLabels(target), targetAnnotations(target)),
	}
	serviceEntry.Spec.Hosts = []string{target.hostname}
	serviceEntry.Spec.Location = istionetworking.ServiceEntry_MESH_EXTERNAL
	serviceEntry.Spec.Resolution = targetServiceEntryResolution(target)
	serviceEntry.Spec.Ports = []*istionetworking.ServicePort{{
		Number:   443,
		Name:     "tls",
		Protocol: "TLS",
	}}
	return serviceEntry
}

func targetServiceEntryResolution(target egressTarget) istionetworking.ServiceEntry_Resolution {
	if strings.HasPrefix(target.hostname, "*.") {
		return istionetworking.ServiceEntry_NONE
	}
	return istionetworking.ServiceEntry_DNS
}

func proxyServiceEntry(namespace string, proxy egressProxyAddress) *istionetworkingv1.ServiceEntry {
	serviceEntry := &istionetworkingv1.ServiceEntry{
		TypeMeta:   istioTypeMeta(serviceEntryGVK.Kind),
		ObjectMeta: istioObjectMeta(namespace, proxyResourceName(proxy.proxyID), proxyLabels(proxy), proxyAnnotations(proxy)),
	}
	serviceEntry.Spec.Hosts = []string{proxyServiceHost(proxy)}
	serviceEntry.Spec.Location = istionetworking.ServiceEntry_MESH_INTERNAL
	serviceEntry.Spec.Resolution = proxyServiceEntryResolution(proxy)
	serviceEntry.Spec.Ports = []*istionetworking.ServicePort{{
		Number:   uint32(proxy.port),
		Name:     "http",
		Protocol: "HTTP",
	}}
	serviceEntry.Spec.Endpoints = []*istionetworking.WorkloadEntry{{
		Address: proxy.address,
		Ports:   map[string]uint32{"http": uint32(proxy.port)},
		Labels:  map[string]string{labelEgressProxyID: proxy.proxyID},
	}}
	return serviceEntry
}

func proxyServiceEntryResolution(proxy egressProxyAddress) istionetworking.ServiceEntry_Resolution {
	if proxy.isIP {
		return istionetworking.ServiceEntry_STATIC
	}
	return istionetworking.ServiceEntry_DNS
}
