package egresspolicies

import (
	"context"
	"fmt"
	"strings"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"
	ctrlclient "sigs.k8s.io/controller-runtime/pkg/client"
)

type gatewayProjection struct {
	gateway   *unstructured.Unstructured
	targets   []egressTarget
	proxies   []egressProxyAddress
	resources []*unstructured.Unstructured
}

func projectGatewayResources(
	ctx context.Context,
	reader ctrlclient.Reader,
	namespace string,
	gatewayNamespace string,
) (gatewayProjection, error) {
	projection := gatewayProjection{}
	gateway, err := getOptional(ctx, reader, gatewayNamespace, gatewayName, gatewayGVK)
	if err != nil {
		return gatewayProjection{}, err
	}
	projection.gateway = gateway
	if gateway != nil {
		projection.resources = append(projection.resources, gateway)
	}
	routes, err := listManaged(ctx, reader, namespace, virtualServiceListGVK)
	if err != nil {
		return gatewayProjection{}, err
	}
	for _, route := range routes {
		target, ok, err := targetFromRoute(route)
		if err != nil {
			return gatewayProjection{}, err
		}
		projection.resources = append(projection.resources, route)
		if ok {
			projection.targets = append(projection.targets, target)
		}
	}
	serviceEntryNamespaces := []string{namespace}
	destinationRuleNamespaces := []string{namespace}
	if gatewayNamespace != namespace {
		serviceEntryNamespaces = append(serviceEntryNamespaces, gatewayNamespace)
		destinationRuleNamespaces = append(destinationRuleNamespaces, gatewayNamespace)
	}
	for _, itemNamespace := range serviceEntryNamespaces {
		serviceEntries, err := listManaged(ctx, reader, itemNamespace, serviceEntryListGVK)
		if err != nil {
			return gatewayProjection{}, err
		}
		for _, serviceEntry := range serviceEntries {
			projection.resources = append(projection.resources, serviceEntry)
			proxy, ok, err := proxyFromServiceEntry(serviceEntry)
			if err != nil {
				return gatewayProjection{}, err
			}
			if ok {
				projection.proxies = append(projection.proxies, proxy)
			}
		}
	}
	for _, itemNamespace := range destinationRuleNamespaces {
		destinationRules, err := listManaged(ctx, reader, itemNamespace, destinationRuleListGVK)
		if err != nil {
			return gatewayProjection{}, err
		}
		projection.resources = append(projection.resources, destinationRules...)
	}
	sortTargets(projection.targets)
	projection.proxies = uniqueProxies(projection.proxies)
	sortProxies(projection.proxies)
	return projection, nil
}

func getOptional(ctx context.Context, reader ctrlclient.Reader, namespace string, name string, gvk schema.GroupVersionKind) (*unstructured.Unstructured, error) {
	obj := &unstructured.Unstructured{}
	obj.SetGroupVersionKind(gvk)
	if err := reader.Get(ctx, types.NamespacedName{Namespace: namespace, Name: name}, obj); err != nil {
		if apierrors.IsNotFound(err) {
			return nil, nil
		}
		return nil, fmt.Errorf("read %s/%s: %w", gvk.Kind, name, err)
	}
	return obj, nil
}

func listManaged(ctx context.Context, reader ctrlclient.Reader, namespace string, listGVK schema.GroupVersionKind) ([]*unstructured.Unstructured, error) {
	list := &unstructured.UnstructuredList{}
	list.SetGroupVersionKind(listGVK)
	if err := reader.List(ctx, list, ctrlclient.InNamespace(namespace), ctrlclient.MatchingLabels(gatewayLabels())); err != nil {
		return nil, fmt.Errorf("list managed %s: %w", listGVK.Kind, err)
	}
	out := make([]*unstructured.Unstructured, 0, len(list.Items))
	for i := range list.Items {
		out = append(out, &list.Items[i])
	}
	return out, nil
}

func uniqueProxies(input []egressProxyAddress) []egressProxyAddress {
	if len(input) < 2 {
		return input
	}
	seen := make(map[string]struct{}, len(input))
	out := make([]egressProxyAddress, 0, len(input))
	for _, proxy := range input {
		if _, ok := seen[proxy.proxyID]; ok {
			continue
		}
		seen[proxy.proxyID] = struct{}{}
		out = append(out, proxy)
	}
	return out
}

func targetFromRoute(route *unstructured.Unstructured) (egressTarget, bool, error) {
	labels := route.GetLabels()
	if labels[labelEgressRole] != egressRoleTarget {
		return egressTarget{}, false, nil
	}
	hostnames, _, _ := unstructured.NestedStringSlice(route.Object, "spec", "hosts")
	if len(hostnames) == 0 {
		return egressTarget{}, false, fmt.Errorf("%s/%s has no hostname", route.GetKind(), route.GetName())
	}
	target, err := newTargetForHostPattern(hostnames[0])
	if err != nil {
		return egressTarget{}, false, err
	}
	target.routeName = route.GetName()
	target.serviceEntryName = targetResourceName(target.hostname)
	target.source = strings.TrimSpace(labels[labelEgressSource])
	target.ruleSetID = strings.TrimSpace(labels[labelEgressRuleSetID])
	target.ruleID = strings.TrimSpace(labels[labelEgressRuleID])
	target.proxyID = strings.TrimSpace(labels[labelEgressProxyID])
	if target.proxyID != "" {
		target.action = egressActionProxy
	} else {
		target.action = egressActionDirect
	}
	target.displayName = route.GetAnnotations()[annotationDisplayName]
	target.sourceURL = route.GetAnnotations()[annotationSourceURL]
	return target, true, nil
}
