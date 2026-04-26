package egresspolicies

import (
	"context"
	"fmt"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	ctrlclient "sigs.k8s.io/controller-runtime/pkg/client"
)

func (s *Service) deleteStaleRoutes(ctx context.Context, desiredNames map[string]struct{}) error {
	return s.deleteStaleObjects(ctx, virtualServiceListGVK, egressRoleTarget, desiredNames)
}

func (s *Service) deleteStaleGatewayRoutes(ctx context.Context, desiredNames map[string]struct{}) error {
	return s.deleteStaleObjectsInNamespace(ctx, s.gatewayRuntime.namespace, virtualServiceListGVK, egressRoleTarget, desiredNames)
}

func (s *Service) deleteStaleServiceEntries(ctx context.Context, role string, desiredNames map[string]struct{}) error {
	return s.deleteStaleObjects(ctx, serviceEntryListGVK, role, desiredNames)
}

func (s *Service) deleteStaleServiceEntriesInNamespace(
	ctx context.Context,
	namespace string,
	role string,
	desiredNames map[string]struct{},
) error {
	return s.deleteStaleObjectsInNamespace(ctx, namespace, serviceEntryListGVK, role, desiredNames)
}

func (s *Service) deleteStaleDestinationRules(ctx context.Context, role string, desiredNames map[string]struct{}) error {
	return s.deleteStaleObjects(ctx, destinationRuleListGVK, role, desiredNames)
}

func (s *Service) deleteStaleDestinationRulesInNamespace(
	ctx context.Context,
	namespace string,
	role string,
	desiredNames map[string]struct{},
) error {
	return s.deleteStaleObjectsInNamespace(ctx, namespace, destinationRuleListGVK, role, desiredNames)
}

func (s *Service) deleteAllEgressResources(ctx context.Context) error {
	if err := s.deleteStaleRoutes(ctx, map[string]struct{}{}); err != nil {
		return err
	}
	if err := s.deleteStaleGatewayRoutes(ctx, map[string]struct{}{}); err != nil {
		return err
	}
	if err := s.deleteStaleServiceEntries(ctx, egressRoleTarget, map[string]struct{}{}); err != nil {
		return err
	}
	if err := s.deleteStaleServiceEntriesInNamespace(ctx, s.gatewayRuntime.namespace, egressRoleProxy, map[string]struct{}{}); err != nil {
		return err
	}
	if err := s.deleteStaleDestinationRules(ctx, egressRoleTarget, map[string]struct{}{}); err != nil {
		return err
	}
	if err := s.deleteStaleDestinationRulesInNamespace(ctx, s.gatewayRuntime.namespace, egressRoleProxy, map[string]struct{}{}); err != nil {
		return err
	}
	if s.gatewayRuntime.namespace != s.namespace {
		if err := s.deleteStaleServiceEntries(ctx, egressRoleProxy, map[string]struct{}{}); err != nil {
			return err
		}
		if err := s.deleteStaleDestinationRules(ctx, egressRoleProxy, map[string]struct{}{}); err != nil {
			return err
		}
	}
	if err := s.deleteGatewayBaseResources(ctx); err != nil {
		return err
	}
	return nil
}

func (s *Service) deleteGatewayBaseResources(ctx context.Context) error {
	for _, item := range []struct {
		gvk       schema.GroupVersionKind
		namespace string
		name      string
	}{
		{gvk: gatewayGVK, namespace: s.gatewayRuntime.namespace, name: gatewayName},
		{gvk: destinationRuleGVK, namespace: s.namespace, name: egressGatewayRuleName},
	} {
		obj := &unstructured.Unstructured{}
		obj.SetGroupVersionKind(item.gvk)
		obj.SetNamespace(item.namespace)
		obj.SetName(item.name)
		if err := s.client.Delete(ctx, obj); err != nil && !apierrors.IsNotFound(err) {
			return fmt.Errorf("delete stale %s %s/%s: %w", item.gvk.Kind, item.namespace, item.name, err)
		}
	}
	return nil
}

func (s *Service) deleteStaleObjects(
	ctx context.Context,
	listGVK schema.GroupVersionKind,
	role string,
	desiredNames map[string]struct{},
) error {
	return s.deleteStaleObjectsInNamespace(ctx, s.namespace, listGVK, role, desiredNames)
}

func (s *Service) deleteStaleObjectsInNamespace(
	ctx context.Context,
	namespace string,
	listGVK schema.GroupVersionKind,
	role string,
	desiredNames map[string]struct{},
) error {
	list := &unstructured.UnstructuredList{}
	list.SetGroupVersionKind(listGVK)
	if err := s.reader.List(ctx, list, ctrlclient.InNamespace(namespace), ctrlclient.MatchingLabels(gatewayLabels())); err != nil {
		return fmt.Errorf("list managed %s: %w", listGVK.Kind, err)
	}
	for i := range list.Items {
		item := &list.Items[i]
		if item.GetLabels()[labelEgressRole] != role {
			continue
		}
		if _, ok := desiredNames[item.GetName()]; ok {
			continue
		}
		if err := s.client.Delete(ctx, item); err != nil && !apierrors.IsNotFound(err) {
			return fmt.Errorf("delete stale %s %s: %w", item.GetKind(), item.GetName(), err)
		}
	}
	return nil
}

func desiredRouteNames(targets []egressTarget) map[string]struct{} {
	out := map[string]struct{}{}
	for _, target := range targets {
		out[target.routeName] = struct{}{}
	}
	return out
}

func desiredServiceEntryNames(targets []egressTarget) map[string]struct{} {
	out := map[string]struct{}{}
	for _, target := range targets {
		out[target.serviceEntryName] = struct{}{}
	}
	return out
}

func desiredProxyServiceEntryNames(proxies []egressProxyAddress) map[string]struct{} {
	out := map[string]struct{}{}
	for _, proxy := range proxies {
		out[proxyResourceName(proxy.proxyID)] = struct{}{}
	}
	return out
}

func desiredProxyDestinationRuleNames(targets []egressTarget) map[string]struct{} {
	out := map[string]struct{}{}
	for _, target := range targets {
		if target.action == egressActionProxy && target.proxyID != "" {
			out[proxyResourceName(target.proxyID)] = struct{}{}
		}
	}
	return out
}

func desiredTargetDestinationRuleNames(targets []egressTarget) map[string]struct{} {
	return map[string]struct{}{}
}
