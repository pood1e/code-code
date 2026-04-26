package authservice

import (
	"context"
	"embed"
	"fmt"
	"strings"

	credentialv1 "code-code.internal/go-contract/credential/v1"
	authv1 "code-code.internal/go-contract/platform/auth/v1"
	"code-code.internal/platform-k8s/egressauth"
	"sigs.k8s.io/yaml"
)

//go:embed header_rewrite_policies.yaml
var headerRewritePolicyFS embed.FS

type headerRewritePolicyCatalog struct {
	policies map[string]headerRewritePolicyConfig
}

type headerRewritePolicyFile struct {
	Policies []headerRewritePolicyConfig `json:"policies"`
}

type headerRewritePolicyConfig struct {
	PolicyID         string                               `json:"policyId"`
	AdapterID        string                               `json:"adapterId"`
	Materializations []headerRewriteMaterializationConfig `json:"materializations"`
}

type headerRewriteMaterializationConfig struct {
	MaterializationKey       string                             `json:"materializationKey"`
	RequestReplacementRules  []egressauth.SimpleReplacementRule `json:"requestReplacementRules"`
	ResponseReplacementRules []egressauth.SimpleReplacementRule `json:"responseReplacementRules"`
	HeaderValuePrefix        string                             `json:"headerValuePrefix"`
}

func loadHeaderRewritePolicyCatalog() (*headerRewritePolicyCatalog, error) {
	raw, err := headerRewritePolicyFS.ReadFile("header_rewrite_policies.yaml")
	if err != nil {
		return nil, err
	}
	var file headerRewritePolicyFile
	if err := yaml.Unmarshal(raw, &file); err != nil {
		return nil, fmt.Errorf("parse header rewrite policies: %w", err)
	}
	catalog := &headerRewritePolicyCatalog{policies: map[string]headerRewritePolicyConfig{}}
	for _, policy := range file.Policies {
		policy.PolicyID = strings.TrimSpace(policy.PolicyID)
		if policy.PolicyID == "" {
			return nil, fmt.Errorf("header rewrite policy id is empty")
		}
		catalog.policies[policy.PolicyID] = policy
	}
	return catalog, nil
}

func (s *Server) GetEgressAuthPolicy(_ context.Context, request *authv1.GetEgressAuthPolicyRequest) (*authv1.GetEgressAuthPolicyResponse, error) {
	if s.headerRewritePolicies == nil {
		return nil, fmt.Errorf("platformk8s/authservice: header rewrite policy catalog is unavailable")
	}
	return s.headerRewritePolicies.resolve(request), nil
}

func (c *headerRewritePolicyCatalog) resolve(request *authv1.GetEgressAuthPolicyRequest) *authv1.GetEgressAuthPolicyResponse {
	policyID := strings.TrimSpace(request.GetPolicyId())
	materializationKey := strings.TrimSpace(request.GetMaterializationKey())
	if policyID == "" {
		policyID = fallbackAuthPolicyID(request.GetCredentialKind(), request.GetProtocol().String())
	}
	policy, ok := c.policies[policyID]
	if !ok {
		policy = fallbackHeaderRewritePolicy(policyID, request.GetCredentialKind(), request.GetProtocol().String())
	}
	materialization := selectHeaderRewriteMaterialization(policy, materializationKey)
	requestRules := normalizeSimpleRules(materialization.RequestReplacementRules)
	responseRules := normalizeSimpleRules(materialization.ResponseReplacementRules)
	return &authv1.GetEgressAuthPolicyResponse{
		PolicyId:                 policyID,
		MaterializationKey:       firstNonEmptyString(materialization.MaterializationKey, materializationKey),
		AdapterId:                strings.TrimSpace(policy.AdapterID),
		RequestReplacementRules:  egressSimpleRulesToProto(requestRules),
		ResponseReplacementRules: egressSimpleRulesToProto(responseRules),
		RequestHeaderNames:       egressauth.SimpleReplacementRuleHeaderNames(requestRules),
		ResponseHeaderNames:      egressauth.SimpleReplacementRuleHeaderNames(responseRules),
		HeaderValuePrefix:        strings.TrimSpace(materialization.HeaderValuePrefix),
	}
}

func selectHeaderRewriteMaterialization(policy headerRewritePolicyConfig, materializationKey string) headerRewriteMaterializationConfig {
	materializationKey = strings.TrimSpace(materializationKey)
	for _, item := range policy.Materializations {
		if strings.TrimSpace(item.MaterializationKey) == materializationKey {
			return item
		}
	}
	if len(policy.Materializations) > 0 {
		return policy.Materializations[0]
	}
	return headerRewriteMaterializationConfig{MaterializationKey: materializationKey}
}

func normalizeSimpleRules(rules []egressauth.SimpleReplacementRule) []egressauth.SimpleReplacementRule {
	out := make([]egressauth.SimpleReplacementRule, 0, len(rules))
	for _, rule := range rules {
		rule = egressauth.NormalizeSimpleReplacementRule(rule)
		if strings.TrimSpace(rule.HeaderName) != "" {
			out = append(out, rule)
		}
	}
	return out
}

func fallbackHeaderRewritePolicy(policyID string, kind credentialv1.CredentialKind, protocol string) headerRewritePolicyConfig {
	mode := egressauth.SimpleReplacementModeBearer
	header := "authorization"
	key := "api_key"
	prefix := "Bearer"
	if kind == credentialv1.CredentialKind_CREDENTIAL_KIND_OAUTH {
		key = "access_token"
	}
	switch {
	case strings.Contains(strings.ToLower(protocol), "anthropic"):
		mode = egressauth.SimpleReplacementModeXAPIKey
		header = "x-api-key"
		prefix = ""
	case strings.Contains(strings.ToLower(protocol), "gemini"):
		mode = egressauth.SimpleReplacementModeGoogleAPIKey
		header = "x-goog-api-key"
		prefix = ""
	}
	return headerRewritePolicyConfig{
		PolicyID: policyID,
		Materializations: []headerRewriteMaterializationConfig{{
			RequestReplacementRules: []egressauth.SimpleReplacementRule{{
				Mode:              mode,
				HeaderName:        header,
				MaterialKey:       key,
				HeaderValuePrefix: prefix,
			}},
		}},
	}
}

func fallbackAuthPolicyID(kind credentialv1.CredentialKind, protocol string) string {
	suffix := ".api-key"
	if kind == credentialv1.CredentialKind_CREDENTIAL_KIND_OAUTH {
		suffix = ".oauth"
	}
	protocol = strings.ToLower(strings.TrimPrefix(protocol, "PROTOCOL_"))
	protocol = strings.ReplaceAll(protocol, "_", "-")
	if protocol == "" || protocol == "unspecified" {
		protocol = "default"
	}
	return "protocol." + protocol + suffix
}
