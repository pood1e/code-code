package egresspolicies

import (
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

func gatewayObject(
	gvk schema.GroupVersionKind,
	namespace string,
	name string,
	spec map[string]any,
	labels map[string]string,
	annotations map[string]string,
) *unstructured.Unstructured {
	obj := &unstructured.Unstructured{Object: map[string]any{
		"metadata": map[string]any{"name": name, "namespace": namespace},
		"spec":     spec,
	}}
	obj.SetGroupVersionKind(gvk)
	obj.SetLabels(mergeStringMaps(gatewayLabels(), labels))
	obj.SetAnnotations(annotations)
	return obj
}
