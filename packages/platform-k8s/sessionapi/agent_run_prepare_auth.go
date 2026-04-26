package sessionapi

import (
	"context"
	"fmt"
	"strings"

	authv1 "code-code.internal/go-contract/platform/auth/v1"
	egressservicev1 "code-code.internal/go-contract/platform/egress/v1"
	managementv1 "code-code.internal/go-contract/platform/management/v1"
	supportv1 "code-code.internal/go-contract/platform/support/v1"
	providerv1 "code-code.internal/go-contract/provider/v1"
	"code-code.internal/platform-k8s/agentrunauth"
	"code-code.internal/platform-k8s/egressauth"
	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
)

func (s *SessionServer) prepareAgentRunAuthProjection(ctx context.Context, namespace string, body prepareAgentRunJobTriggerRequest) error {
	if strings.TrimSpace(body.Job.JobType) != "auth" {
		return nil
	}
	projection, err := s.agentRunAuthProjection(ctx, body)
	if err != nil {
		return err
	}
	name := agentrunauth.ProjectedSecretName(s.namespace, firstNonEmpty(body.AgentRunResourceName, body.RunID), body.RunID)
	if name == "" {
		return fmt.Errorf("platformk8s/sessionapi: projected auth secret name is empty")
	}
	next := &corev1.Secret{
		ObjectMeta: metav1.ObjectMeta{
			Name:        name,
			Namespace:   namespace,
			Labels:      projectedAuthLabels(body),
			Annotations: agentrunauth.SecretAnnotations(projection),
		},
		Type: corev1.SecretTypeOpaque,
		Data: map[string][]byte{
			projection.MaterializationKey: []byte(egressauth.Placeholder),
		},
	}
	current := &corev1.Secret{}
	if err := s.runtimeClient.Get(ctx, types.NamespacedName{Namespace: namespace, Name: name}, current); err != nil {
		if apierrors.IsNotFound(err) {
			return s.runtimeClient.Create(ctx, next)
		}
		return fmt.Errorf("platformk8s/sessionapi: get projected auth secret %q: %w", name, err)
	}
	next.ResourceVersion = current.ResourceVersion
	return s.runtimeClient.Update(ctx, next)
}

func (s *SessionServer) deleteAgentRunAuthProjection(ctx context.Context, namespace string, body cleanupAgentRunTriggerRequest) error {
	if !cleanupHasAuthJob(body.Jobs) {
		return nil
	}
	name := agentrunauth.ProjectedSecretName(s.namespace, firstNonEmpty(body.AgentRunResourceName, body.RunID), body.RunID)
	if name == "" {
		return nil
	}
	current := &corev1.Secret{}
	if err := s.runtimeClient.Get(ctx, types.NamespacedName{Namespace: namespace, Name: name}, current); err != nil {
		if apierrors.IsNotFound(err) {
			return nil
		}
		return err
	}
	if err := s.runtimeClient.Delete(ctx, current); err != nil && !apierrors.IsNotFound(err) {
		return err
	}
	return nil
}

func (s *SessionServer) agentRunAuthProjection(ctx context.Context, body prepareAgentRunJobTriggerRequest) (agentrunauth.Projection, error) {
	surfaceProjection, err := s.runtimeCatalog.GetProviderSurfaceBinding(ctx, body.ProviderSurfaceBindingID)
	if err != nil {
		return agentrunauth.Projection{}, err
	}
	if surfaceProjection == nil || surfaceProjection.Surface == nil || surfaceProjection.Surface.GetRuntime() == nil || providerv1.RuntimeKind(surfaceProjection.Surface.GetRuntime()) == providerv1.ProviderSurfaceKind_PROVIDER_SURFACE_KIND_UNSPECIFIED {
		return agentrunauth.Projection{}, fmt.Errorf("platformk8s/sessionapi: provider surface binding %q runtime is invalid", body.ProviderSurfaceBindingID)
	}
	credentialID := strings.TrimSpace(surfaceProjection.Surface.GetProviderCredentialRef().GetProviderCredentialId())
	if credentialID == "" {
		return agentrunauth.Projection{}, fmt.Errorf("platformk8s/sessionapi: provider surface binding %q credential is empty", body.ProviderSurfaceBindingID)
	}
	credentialResponse, err := s.auth.GetCredentialRuntimeProjection(ctx, &authv1.GetCredentialRuntimeProjectionRequest{
		CredentialId: credentialID,
	})
	if err != nil {
		return agentrunauth.Projection{}, err
	}
	credential := credentialResponse.GetCredential()
	if credential == nil {
		return agentrunauth.Projection{}, fmt.Errorf("platformk8s/sessionapi: credential %q runtime projection is empty", credentialID)
	}
	runtime := surfaceProjection.Surface.GetRuntime()
	cliID := firstNonEmpty(body.Job.CLIID, body.ProviderID, providerv1.RuntimeCLIID(runtime))
	runtimeURL := firstNonEmpty(body.RuntimeURL, providerv1.RuntimeBaseURL(runtime))
	protocol := providerv1.RuntimeProtocol(runtime)
	capabilities, err := s.support.ResolveProviderCapabilities(ctx, &supportv1.ResolveProviderCapabilitiesRequest{
		Subject: &supportv1.ResolveProviderCapabilitiesRequest_Runtime{Runtime: &supportv1.RuntimeCapabilitySubject{
			ProviderId:             firstNonEmpty(body.ProviderID, cliID),
			SurfaceId:              surfaceProjection.Surface.GetSurfaceId(),
			Protocol:               protocol,
			CredentialKind:         credential.GetCredentialKind(),
			RuntimeUrl:             runtimeURL,
			AuthMaterializationKey: body.AuthMaterializationKey,
			ExecutionContext:       supportv1.CapabilityExecutionContext_CAPABILITY_EXECUTION_CONTEXT_AGENT_RUN,
		}},
	})
	if err != nil {
		return agentrunauth.Projection{}, err
	}
	materializationKey := strings.TrimSpace(firstNonEmpty(capabilities.GetAuthMaterializationKey(), body.AuthMaterializationKey))
	if expected := strings.TrimSpace(body.AuthMaterializationKey); expected != "" && materializationKey != "" && expected != materializationKey {
		return agentrunauth.Projection{}, fmt.Errorf("platformk8s/sessionapi: auth materialization key %q does not match %q", expected, materializationKey)
	}
	egressPolicy, err := s.egress.GetEgressRuntimePolicy(ctx, &egressservicev1.GetEgressRuntimePolicyRequest{
		PolicyId:   capabilities.GetEgressPolicyId(),
		RuntimeUrl: runtimeURL,
	})
	if err != nil {
		return agentrunauth.Projection{}, err
	}
	authPolicy, err := s.auth.GetEgressAuthPolicy(ctx, &authv1.GetEgressAuthPolicyRequest{
		PolicyId:           capabilities.GetAuthPolicyId(),
		MaterializationKey: materializationKey,
		CredentialKind:     credential.GetCredentialKind(),
		Protocol:           protocol,
	})
	if err != nil {
		return agentrunauth.Projection{}, err
	}
	return agentrunauth.Projection{
		SourceName:                     agentrunauth.SourceSecretName(credential.GetSecretName()),
		MaterializationKey:             firstNonEmpty(authPolicy.GetMaterializationKey(), materializationKey),
		RuntimeURL:                     runtimeURL,
		TargetHosts:                    append([]string(nil), egressPolicy.GetPolicy().GetTargetHosts()...),
		TargetPathPrefixes:             append([]string(nil), egressPolicy.GetPolicy().GetTargetPathPrefixes()...),
		RequestHeaderNames:             append([]string(nil), authPolicy.GetRequestHeaderNames()...),
		HeaderValuePrefix:              authPolicy.GetHeaderValuePrefix(),
		RequestHeaderReplacementRules:  authRulesToRuntimeRules(authPolicy.GetRequestReplacementRules()),
		ResponseHeaderReplacementRules: authRulesToRuntimeRules(authPolicy.GetResponseReplacementRules()),
		ResponseHeaderMetricRules:      dedupeAgentRunResponseHeaderRules(s.headerMetricPolicies.rules(capabilities.GetHeaderMetricPolicyId())),
		EgressPolicyID:                 capabilities.GetEgressPolicyId(),
		AuthPolicyID:                   capabilities.GetAuthPolicyId(),
		HeaderMetricPolicyID:           capabilities.GetHeaderMetricPolicyId(),
		ProviderID:                     firstNonEmpty(body.ProviderID, cliID),
		VendorID:                       credential.GetVendorId(),
		ProviderSurfaceBindingID:       surfaceProjection.Surface.GetSurfaceId(),
		CLIID:                          cliID,
	}, nil
}

func authRulesToRuntimeRules(rules []*authv1.EgressSimpleReplacementRule) []*managementv1.AgentRunRuntimeHeaderReplacementRule {
	out := make([]*managementv1.AgentRunRuntimeHeaderReplacementRule, 0, len(rules))
	for _, rule := range rules {
		if rule == nil {
			continue
		}
		out = append(out, &managementv1.AgentRunRuntimeHeaderReplacementRule{
			Mode:              rule.GetMode(),
			HeaderName:        rule.GetHeaderName(),
			MaterialKey:       rule.GetMaterialKey(),
			HeaderValuePrefix: rule.GetHeaderValuePrefix(),
			Template:          rule.GetTemplate(),
		})
	}
	return out
}

func projectedAuthLabels(body prepareAgentRunJobTriggerRequest) map[string]string {
	return map[string]string{
		egressauth.ProjectedCredentialManagedByLabel: egressauth.ProjectedCredentialManagedByValue,
		egressauth.ProjectedCredentialRunNameLabel:   strings.TrimSpace(firstNonEmpty(body.AgentRunResourceName, body.RunID)),
		egressauth.ProjectedCredentialRunIDLabel:     strings.TrimSpace(body.RunID),
		egressauth.ProjectedCredentialSessionIDLabel: strings.TrimSpace(body.SessionID),
	}
}

func cleanupHasAuthJob(jobs []prepareAgentRunJobPayload) bool {
	for _, job := range jobs {
		if strings.TrimSpace(job.JobType) == "auth" {
			return true
		}
	}
	return false
}
