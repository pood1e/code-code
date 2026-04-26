package credentials

import (
	"context"
	"fmt"
	"strings"

	credentialcontract "code-code.internal/agent-runtime-contract/credential"
	credentialv1 "code-code.internal/go-contract/credential/v1"
	"code-code.internal/go-contract/domainerror"
	platformv1alpha1 "code-code.internal/platform-k8s/api/v1alpha1"
	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
	ctrlclient "sigs.k8s.io/controller-runtime/pkg/client"
)

const ConditionCredentialMaterialReady = "MaterialReady"

// MaterialReadinessReader validates credential-owned material readiness.
type MaterialReadinessReader struct {
	client    ctrlclient.Client
	namespace string
}

// NewMaterialReadinessReader creates one Kubernetes-backed material readiness reader.
func NewMaterialReadinessReader(client ctrlclient.Client, namespace string) (*MaterialReadinessReader, error) {
	if client == nil {
		return nil, fmt.Errorf("credentials: material readiness client is nil")
	}
	if strings.TrimSpace(namespace) == "" {
		return nil, fmt.Errorf("credentials: material readiness namespace is empty")
	}
	return &MaterialReadinessReader{
		client:    client,
		namespace: strings.TrimSpace(namespace),
	}, nil
}

// ValidateReady checks whether one credential currently exposes usable auth material.
func (r *MaterialReadinessReader) ValidateReady(ctx context.Context, ref *credentialcontract.CredentialRef) error {
	resource, err := r.getCredentialResource(ctx, ref)
	if err != nil {
		return err
	}
	if condition := currentMaterialReadyCondition(resource); condition != nil {
		if condition.Status == metav1.ConditionTrue {
			return nil
		}
		message := strings.TrimSpace(condition.Message)
		if message == "" {
			message = "credential auth material is not ready"
		}
		return domainerror.NewValidation(
			"credentials: credential %q material is not ready: %s",
			resource.GetName(),
			message,
		)
	}
	return validateCredentialResourceMaterial(ctx, r.client, r.namespace, resource)
}

func (r *MaterialReadinessReader) getCredentialResource(ctx context.Context, ref *credentialcontract.CredentialRef) (*platformv1alpha1.CredentialDefinitionResource, error) {
	if err := credentialv1.ValidateRef(ref); err != nil {
		return nil, err
	}
	resource := &platformv1alpha1.CredentialDefinitionResource{}
	key := types.NamespacedName{Namespace: r.namespace, Name: ref.GetCredentialId()}
	if err := r.client.Get(ctx, key, resource); err != nil {
		return nil, mapCredentialGetError(ref.GetCredentialId(), err)
	}
	return resource, nil
}

func currentMaterialReadyCondition(resource *platformv1alpha1.CredentialDefinitionResource) *metav1.Condition {
	if resource == nil {
		return nil
	}
	condition := meta.FindStatusCondition(resource.Status.Conditions, ConditionCredentialMaterialReady)
	if condition == nil {
		return nil
	}
	if condition.ObservedGeneration != resource.GetGeneration() {
		return nil
	}
	return condition
}

func validateCredentialResourceMaterial(
	ctx context.Context,
	client ctrlclient.Client,
	namespace string,
	resource *platformv1alpha1.CredentialDefinitionResource,
) error {
	if resource == nil {
		return domainerror.NewValidation("credentials: credential resource is nil")
	}
	definition, err := credentialsDefinitionFromResource(resource)
	if err != nil {
		return err
	}
	source := secretSourceFromResource(resource)
	secret := &corev1.Secret{}
	key := types.NamespacedName{Namespace: namespace, Name: source.Name}
	if err := client.Get(ctx, key, secret); err != nil {
		return mapCredentialSecretGetError(definition.GetCredentialId(), source.Name, err)
	}
	resolved, err := resolveFromSecret(definition, secret, source, resource.Status.OAuth)
	if err != nil {
		return err
	}
	if err := credentialv1.ValidateResolvedCredential(resolved); err != nil {
		return domainerror.NewValidation("credentials: invalid resolved credential %q: %v", definition.GetCredentialId(), err)
	}
	return nil
}

func secretSourceFromResource(resource *platformv1alpha1.CredentialDefinitionResource) *platformv1alpha1.CredentialSecretSource {
	if resource == nil {
		return &platformv1alpha1.CredentialSecretSource{}
	}
	source := &platformv1alpha1.CredentialSecretSource{}
	if resource.Spec.SecretSource != nil {
		*source = *resource.Spec.SecretSource
	}
	if strings.TrimSpace(source.Name) == "" {
		source.Name = resource.GetName()
	}
	return source
}

func mapCredentialGetError(credentialID string, err error) error {
	if apierrors.IsNotFound(err) {
		return domainerror.NewNotFound("credentials: credential %q not found", credentialID)
	}
	return fmt.Errorf("credentials: get credential %q: %w", credentialID, err)
}

func mapCredentialSecretGetError(credentialID, secretName string, err error) error {
	if apierrors.IsNotFound(err) {
		return domainerror.NewValidation("credentials: backing secret %q not found for credential %q", secretName, credentialID)
	}
	return fmt.Errorf("credentials: get secret %q: %w", secretName, err)
}
