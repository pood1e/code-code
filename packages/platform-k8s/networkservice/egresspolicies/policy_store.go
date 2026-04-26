package egresspolicies

import (
	"context"
	"fmt"
	"strings"

	egressv1 "code-code.internal/go-contract/egress/v1"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"
	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
	ctrlclient "sigs.k8s.io/controller-runtime/pkg/client"
)

const (
	policyConfigMapName     = "code-code-egress-policy"
	policyConfigKey         = "policy.json"
	policyExternalStatusKey = "external-rule-set-status.json"
	presetProxyID           = "preset-proxy"
	presetProxyName         = "Preset HTTP Proxy"
	presetProxyURL          = "http://127.0.0.1:10809"
	externalRuleSetURL      = "https://raw.githubusercontent.com/gfwlist/gfwlist/master/gfwlist.txt"
	externalSourceHost      = "raw.githubusercontent.com"
	externalSourceRule      = "external-rule-set-source-host"
	externalSourceName      = "External Rule Set Source Host"
)

var policyJSON = protojson.MarshalOptions{
	UseProtoNames:   true,
	EmitUnpopulated: true,
}

var policyJSONRead = protojson.UnmarshalOptions{
	DiscardUnknown: true,
}

func (s *Service) loadPolicyState(ctx context.Context) (*egressv1.EgressPolicy, *egressv1.EgressExternalRuleSetStatus, error) {
	config := &corev1.ConfigMap{}
	if err := s.reader.Get(ctx, types.NamespacedName{Namespace: s.namespace, Name: policyConfigMapName}, config); err != nil {
		if apierrors.IsNotFound(err) {
			policy := defaultPolicy()
			return policy, disabledExternalRuleSetStatus(policy.GetExternalRuleSet()), nil
		}
		return nil, nil, fmt.Errorf("read egress policy config: %w", err)
	}
	payload := strings.TrimSpace(config.Data[policyConfigKey])
	if payload == "" {
		return nil, nil, fmt.Errorf("egress policy config %s/%s has no %s", s.namespace, policyConfigMapName, policyConfigKey)
	}
	policy := &egressv1.EgressPolicy{}
	if err := policyJSONRead.Unmarshal([]byte(payload), policy); err != nil {
		return nil, nil, fmt.Errorf("parse egress policy config %s/%s: %w", s.namespace, policyConfigMapName, err)
	}
	statusPayload := strings.TrimSpace(config.Data[policyExternalStatusKey])
	status := &egressv1.EgressExternalRuleSetStatus{}
	if statusPayload != "" {
		if err := policyJSONRead.Unmarshal([]byte(statusPayload), status); err != nil {
			return nil, nil, fmt.Errorf("parse egress policy config %s/%s key %s: %w", s.namespace, policyConfigMapName, policyExternalStatusKey, err)
		}
	} else {
		status = nil
	}
	return normalizePolicy(policy), status, nil
}

func (s *Service) savePolicy(ctx context.Context, policy *egressv1.EgressPolicy, status *egressv1.EgressExternalRuleSetStatus) error {
	normalized := normalizePolicy(policy)
	payload, err := policyJSON.Marshal(normalized)
	if err != nil {
		return fmt.Errorf("marshal egress policy: %w", err)
	}
	statusPayload, err := marshalExternalRuleSetStatus(status, normalized.GetExternalRuleSet())
	if err != nil {
		return err
	}
	config := &corev1.ConfigMap{}
	key := types.NamespacedName{Namespace: s.namespace, Name: policyConfigMapName}
	if err := s.client.Get(ctx, key, config); err != nil {
		if !apierrors.IsNotFound(err) {
			return fmt.Errorf("read egress policy config: %w", err)
		}
		config = &corev1.ConfigMap{
			ObjectMeta: metav1.ObjectMeta{
				Namespace: s.namespace,
				Name:      policyConfigMapName,
				Labels:    mergeStringMaps(gatewayLabels(), map[string]string{labelEgressRole: egressRolePolicy}),
			},
			Data: map[string]string{
				policyConfigKey:         string(payload),
				policyExternalStatusKey: statusPayload,
			},
		}
		if err := s.client.Create(ctx, config); err != nil {
			return fmt.Errorf("create egress policy config: %w", err)
		}
		return nil
	}
	original := config.DeepCopy()
	config.Labels = mergeStringMaps(config.Labels, gatewayLabels(), map[string]string{labelEgressRole: egressRolePolicy})
	if config.Data == nil {
		config.Data = map[string]string{}
	}
	config.Data[policyConfigKey] = string(payload)
	config.Data[policyExternalStatusKey] = statusPayload
	if err := s.client.Patch(ctx, config, ctrlclient.MergeFrom(original)); err != nil {
		return fmt.Errorf("patch egress policy config: %w", err)
	}
	return nil
}

func marshalExternalRuleSetStatus(status *egressv1.EgressExternalRuleSetStatus, ruleSet *egressv1.EgressExternalRuleSet) (string, error) {
	effective := status
	if effective == nil {
		effective = disabledExternalRuleSetStatus(ruleSet)
	}
	effective = proto.Clone(effective).(*egressv1.EgressExternalRuleSetStatus)
	if strings.TrimSpace(effective.GetSourceUrl()) == "" && ruleSet != nil {
		effective.SourceUrl = strings.TrimSpace(ruleSet.GetSourceUrl())
	}
	payload, err := policyJSON.Marshal(effective)
	if err != nil {
		return "", fmt.Errorf("marshal external AutoProxy status: %w", err)
	}
	return string(payload), nil
}

func normalizePolicy(policy *egressv1.EgressPolicy) *egressv1.EgressPolicy {
	if policy == nil {
		return defaultPolicy()
	}
	normalized := proto.Clone(policy).(*egressv1.EgressPolicy)
	normalized.PolicyId = strings.TrimSpace(normalized.GetPolicyId())
	if normalized.PolicyId == "" {
		normalized.PolicyId = policyID
	}
	normalized.DisplayName = displayNameOr(normalized.GetDisplayName(), policyDisplayName)
	if normalized.ExternalRuleSet == nil {
		normalized.ExternalRuleSet = &egressv1.EgressExternalRuleSet{
			SourceUrl: externalRuleSetURL,
			Enabled:   false,
			Action:    egressv1.EgressAction_EGRESS_ACTION_PROXY,
			ProxyId:   presetProxyID,
		}
	}
	normalized.ExternalRuleSet.SourceUrl = strings.TrimSpace(normalized.ExternalRuleSet.GetSourceUrl())
	if normalized.ExternalRuleSet.GetAction() != egressv1.EgressAction_EGRESS_ACTION_PROXY {
		normalized.ExternalRuleSet.Action = egressv1.EgressAction_EGRESS_ACTION_DIRECT
		normalized.ExternalRuleSet.ProxyId = ""
	} else {
		normalized.ExternalRuleSet.ProxyId = strings.TrimSpace(normalized.ExternalRuleSet.GetProxyId())
	}
	for _, rule := range normalized.GetCustomRules() {
		if rule == nil {
			continue
		}
		if rule.GetAction() != egressv1.EgressAction_EGRESS_ACTION_PROXY {
			rule.ProxyId = ""
		} else {
			rule.ProxyId = strings.TrimSpace(rule.GetProxyId())
		}
	}
	return normalized
}

func defaultPolicy() *egressv1.EgressPolicy {
	return &egressv1.EgressPolicy{
		PolicyId:    policyID,
		DisplayName: policyDisplayName,
		Proxies: []*egressv1.EgressProxy{{
			ProxyId:     presetProxyID,
			DisplayName: presetProxyName,
			Protocol:    egressv1.EgressProxyProtocol_EGRESS_PROXY_PROTOCOL_HTTP,
			Url:         presetProxyURL,
		}},
		CustomRules: []*egressv1.EgressRule{{
			RuleId:      externalSourceRule,
			DisplayName: externalSourceName,
			Match: &egressv1.EgressRuleMatch{
				Kind: &egressv1.EgressRuleMatch_HostExact{HostExact: externalSourceHost},
			},
			Action:  egressv1.EgressAction_EGRESS_ACTION_PROXY,
			ProxyId: presetProxyID,
		}},
		ExternalRuleSet: &egressv1.EgressExternalRuleSet{
			SourceUrl: externalRuleSetURL,
			Enabled:   false,
			Action:    egressv1.EgressAction_EGRESS_ACTION_PROXY,
			ProxyId:   presetProxyID,
		},
	}
}
