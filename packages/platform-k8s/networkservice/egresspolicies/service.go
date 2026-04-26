package egresspolicies

import (
	"context"
	"fmt"
	"reflect"
	"strings"

	egressv1 "code-code.internal/go-contract/egress/v1"
	egressservicev1 "code-code.internal/go-contract/platform/egress/v1"
	managementv1 "code-code.internal/go-contract/platform/management/v1"
	ctrlclient "sigs.k8s.io/controller-runtime/pkg/client"
)

type Service struct {
	client         ctrlclient.Client
	reader         ctrlclient.Reader
	namespace      string
	gatewayRuntime gatewayRuntime
	runtimePolicy  *runtimePolicyCatalog
	externalRules  externalRuleSetLoader
}

// ServiceConfig wires the Kubernetes readers used by the egress policy adapter.
type ServiceConfig struct {
	Client         ctrlclient.Client
	Reader         ctrlclient.Reader
	Namespace      string
	GatewayRuntime GatewayRuntimeConfig
}

func NewService(config ServiceConfig) (*Service, error) {
	if config.Reader == nil {
		return nil, fmt.Errorf("platformk8s/networkservice/egresspolicies: reader is nil")
	}
	if strings.TrimSpace(config.Namespace) == "" {
		return nil, fmt.Errorf("platformk8s/networkservice/egresspolicies: namespace is empty")
	}
	gatewayRuntime, err := newGatewayRuntime(config.GatewayRuntime)
	if err != nil {
		return nil, err
	}
	runtimePolicy, err := loadRuntimePolicyCatalog()
	if err != nil {
		return nil, err
	}
	return &Service{
		client:         config.Client,
		reader:         config.Reader,
		namespace:      strings.TrimSpace(config.Namespace),
		gatewayRuntime: gatewayRuntime,
		runtimePolicy:  runtimePolicy,
		externalRules:  newExternalRuleSetLoader(),
	}, nil
}

func (s *Service) List(ctx context.Context) ([]*managementv1.EgressPolicyView, error) {
	policy, storedExternalStatus, err := s.loadPolicyState(ctx)
	if err != nil {
		return nil, err
	}
	projection, err := projectGatewayResources(ctx, s.reader, s.namespace, s.gatewayRuntime.namespace)
	if err != nil {
		return nil, err
	}
	externalStatus := effectiveExternalRuleSetStatus(policy.GetExternalRuleSet(), storedExternalStatus, projection)
	return []*managementv1.EgressPolicyView{{
		Policy:                policy,
		ConfiguredBy:          sourceView("service", policyID, policyDisplayName, "ConfigMap"),
		Sync:                  syncStatus(policy, s.gatewayRuntime.namespace, projection),
		ExternalRuleSetStatus: externalStatus,
	}}, nil
}

func (s *Service) Update(ctx context.Context, policy *egressv1.EgressPolicy) (*managementv1.EgressPolicyView, error) {
	if s.client == nil {
		return nil, fmt.Errorf("platformk8s/networkservice/egresspolicies: client is nil")
	}
	current, err := projectGatewayResources(ctx, s.reader, s.namespace, s.gatewayRuntime.namespace)
	if err != nil {
		return nil, err
	}
	policy = normalizePolicy(policy)
	desired, externalStatus, err := desiredStateFromPolicy(ctx, policy, current, s.externalRules)
	if err != nil {
		return nil, err
	}
	if err := s.savePolicy(ctx, policy, externalStatus); err != nil {
		return nil, err
	}
	if err := s.applyDesired(ctx, desired); err != nil {
		return nil, err
	}
	items, err := s.List(ctx)
	if err != nil {
		return nil, err
	}
	if len(items) == 0 {
		return nil, fmt.Errorf("egress policy update did not produce a view")
	}
	if externalStatus != nil {
		items[0].ExternalRuleSetStatus = externalStatus
	}
	return items[0], nil
}

func (s *Service) ResolveRuntimePolicy(policyID string, runtimeURL string) (*egressservicev1.EgressRuntimePolicy, error) {
	if s.runtimePolicy == nil {
		return nil, fmt.Errorf("platformk8s/networkservice/egresspolicies: runtime policy catalog is unavailable")
	}
	return s.runtimePolicy.resolve(policyID, runtimeURL)
}

func (s *Service) applyDesired(ctx context.Context, desired gatewayDesiredState) error {
	if len(desired.targets) == 0 {
		return s.deleteAllEgressResources(ctx)
	}
	for _, obj := range desiredGatewayObjects(s.namespace, s.gatewayRuntime, desired.targets, desired.proxies) {
		if err := s.apply(ctx, obj); err != nil {
			return fmt.Errorf("apply %s %s/%s: %w", objectKind(obj), obj.GetNamespace(), obj.GetName(), err)
		}
	}
	if err := s.deleteStaleRoutes(ctx, desiredRouteNames(desired.targets)); err != nil {
		return err
	}
	if err := s.deleteStaleGatewayRoutes(ctx, desiredRouteNames(desired.targets)); err != nil {
		return err
	}
	if err := s.deleteStaleServiceEntries(ctx, egressRoleTarget, desiredServiceEntryNames(desired.targets)); err != nil {
		return err
	}
	if err := s.deleteStaleServiceEntriesInNamespace(
		ctx,
		s.gatewayRuntime.namespace,
		egressRoleProxy,
		desiredProxyServiceEntryNames(desired.proxies),
	); err != nil {
		return err
	}
	if err := s.deleteStaleDestinationRules(ctx, egressRoleTarget, desiredTargetDestinationRuleNames(desired.targets)); err != nil {
		return err
	}
	if err := s.deleteStaleDestinationRulesInNamespace(
		ctx,
		s.gatewayRuntime.namespace,
		egressRoleProxy,
		desiredProxyDestinationRuleNames(desired.targets),
	); err != nil {
		return err
	}
	if s.gatewayRuntime.namespace != s.namespace {
		// Cleanup legacy proxy resources that were historically rendered in the policy namespace.
		if err := s.deleteStaleServiceEntries(ctx, egressRoleProxy, map[string]struct{}{}); err != nil {
			return err
		}
		if err := s.deleteStaleDestinationRules(ctx, egressRoleProxy, map[string]struct{}{}); err != nil {
			return err
		}
	}
	return nil
}

func (s *Service) apply(ctx context.Context, obj ctrlclient.Object) error {
	return s.client.Patch(ctx, obj, ctrlclient.Apply, ctrlclient.FieldOwner(fieldOwner), ctrlclient.ForceOwnership)
}

func objectKind(obj ctrlclient.Object) string {
	kind := obj.GetObjectKind().GroupVersionKind().Kind
	if kind != "" {
		return kind
	}
	return reflect.TypeOf(obj).String()
}
