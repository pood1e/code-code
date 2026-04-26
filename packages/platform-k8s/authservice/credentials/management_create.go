package credentials

import (
	"context"
	"errors"
	"fmt"

	"code-code.internal/go-contract/domainerror"
	managementv1 "code-code.internal/go-contract/platform/management/v1"
	"code-code.internal/platform-k8s/internal/resourceops"
	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
)

// Create stores one new credential and its backing Secret.
func (s *CredentialManagementService) Create(ctx context.Context, credential *Credential) (*managementv1.CredentialView, error) {
	if credential == nil {
		return nil, domainerror.NewValidation("platformk8s/credentials: credential is nil")
	}
	resource := credential.Resource(s.namespace)
	secret, err := credential.Secret(s.namespace)
	if err != nil {
		return nil, err
	}
	if err := resourceops.CreateResource(ctx, s.client, secret, s.namespace, secret.Name); err != nil {
		if apierrors.IsAlreadyExists(err) || apierrors.IsConflict(err) {
			return nil, domainerror.NewAlreadyExists("platformk8s: credential %q already exists", resource.Spec.Definition.CredentialId)
		}
		return nil, err
	}
	if err := s.store.Create(ctx, resource); err != nil {
		err = errors.Join(classifyCredentialCreateError(err, resource.Spec.Definition.CredentialId), s.deleteCreatedCredentialSecret(ctx, secret.Name))
		return nil, err
	}
	return s.credentialResourceToView(ctx, resource)
}

func classifyCredentialCreateError(err error, credentialID string) error {
	if apierrors.IsAlreadyExists(err) || apierrors.IsConflict(err) {
		return domainerror.NewAlreadyExists("platformk8s: credential %q already exists", credentialID)
	}
	return err
}

func (s *CredentialManagementService) deleteCreatedCredentialSecret(ctx context.Context, secretName string) error {
	if err := resourceops.DeleteResource(context.WithoutCancel(ctx), s.client, &corev1.Secret{}, s.namespace, secretName); err != nil {
		return fmt.Errorf("platformk8s/credentials: rollback credential secret %q: %w", secretName, err)
	}
	return nil
}
