package credentials

import (
	"context"
	"strings"

	credentialv1 "code-code.internal/go-contract/credential/v1"
	managementv1 "code-code.internal/go-contract/platform/management/v1"
	platformv1alpha1 "code-code.internal/platform-k8s/api/v1alpha1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	ctrlclient "sigs.k8s.io/controller-runtime/pkg/client"
)

func (s *CredentialManagementService) credentialResourceToView(
	ctx context.Context,
	resource *platformv1alpha1.CredentialDefinitionResource,
) (*managementv1.CredentialView, error) {
	definition, err := credentialsDefinitionFromResource(resource)
	if err != nil {
		return nil, err
	}
	view := credentialDefinitionToView(definition)
	applyCredentialObservedState(view, resource)
	applyCredentialMaterialStatus(ctx, s.client, s.namespace, view, resource)
	applyCredentialOAuthSecretState(ctx, s.client, s.namespace, view, resource)
	return view, nil
}

func credentialDefinitionToView(definition *credentialv1.CredentialDefinition) *managementv1.CredentialView {
	view := &managementv1.CredentialView{
		CredentialId: definition.CredentialId,
		DisplayName:  definition.DisplayName,
		Kind:         definition.Kind.String(),
		VendorId:     definition.VendorId,
	}
	if definition.Purpose != credentialv1.CredentialPurpose_CREDENTIAL_PURPOSE_UNSPECIFIED {
		view.Purpose = definition.Purpose.String()
	}
	if oauth := definition.GetOauthMetadata(); oauth != nil {
		view.CliId = oauth.CliId
	}
	return view
}

func applyCredentialObservedState(view *managementv1.CredentialView, resource *platformv1alpha1.CredentialDefinitionResource) {
	if view == nil || resource == nil || resource.Status.OAuth == nil {
		return
	}
	view.CredentialGeneration = resource.Status.OAuth.CredentialGeneration
	view.AccountEmail = strings.TrimSpace(resource.Status.OAuth.AccountEmail)
}

func applyCredentialMaterialStatus(
	ctx context.Context,
	client ctrlclient.Client,
	namespace string,
	view *managementv1.CredentialView,
	resource *platformv1alpha1.CredentialDefinitionResource,
) {
	if view == nil || resource == nil {
		return
	}
	status := &managementv1.CredentialStatus{}
	if condition := currentMaterialReadyCondition(resource); condition != nil {
		status.MaterialReady = condition.Status == metav1.ConditionTrue
		if !status.MaterialReady {
			status.Reason = materialStatusReason(condition.Message)
		}
		view.Status = status
		return
	}
	if err := validateCredentialResourceMaterial(ctx, client, namespace, resource); err != nil {
		status.MaterialReady = false
		status.Reason = err.Error()
		view.Status = status
		return
	}
	status.MaterialReady = true
	view.Status = status
}

func applyCredentialOAuthSecretState(
	ctx context.Context,
	client ctrlclient.Client,
	namespace string,
	view *managementv1.CredentialView,
	resource *platformv1alpha1.CredentialDefinitionResource,
) {
	if view == nil || resource == nil || resource.Spec.Definition == nil {
		return
	}
	if resource.Spec.Definition.Kind != credentialv1.CredentialKind_CREDENTIAL_KIND_OAUTH {
		return
	}
	secret := &corev1.Secret{}
	key := ctrlclient.ObjectKey{Namespace: namespace, Name: secretSourceFromResource(resource).Name}
	if err := client.Get(ctx, key, secret); err == nil {
		view.ExpiresAt = getOptionalSecretValue(secret, secretKeyExpiresAt)
		if strings.TrimSpace(view.GetAccountEmail()) == "" {
			view.AccountEmail = getOptionalSecretValue(secret, accountEmailSecretKey)
		}
	}
}

func materialStatusReason(message string) string {
	message = strings.TrimSpace(message)
	if message == "" {
		return "credential auth material is not ready"
	}
	return message
}
