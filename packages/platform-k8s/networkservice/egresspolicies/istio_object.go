package egresspolicies

import (
	istionetworkingv1 "istio.io/client-go/pkg/apis/networking/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func istioObjectMeta(namespace string, name string, labels map[string]string, annotations map[string]string) metav1.ObjectMeta {
	return metav1.ObjectMeta{
		Name:        name,
		Namespace:   namespace,
		Labels:      mergeStringMaps(gatewayLabels(), labels),
		Annotations: annotations,
	}
}

func istioTypeMeta(kind string) metav1.TypeMeta {
	return metav1.TypeMeta{
		APIVersion: istionetworkingv1.SchemeGroupVersion.String(),
		Kind:       kind,
	}
}
