package credentials

import (
	"context"
	"fmt"
	"strings"

	credentialv1 "code-code.internal/go-contract/credential/v1"
	"code-code.internal/go-contract/domainerror"
	platformv1alpha1 "code-code.internal/platform-k8s/api/v1alpha1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
)

// RuntimeProjection exposes only the non-secret credential metadata required
// to bind runtime auth material.
type RuntimeProjection struct {
	CredentialID string
	Kind         credentialv1.CredentialKind
	VendorID     string
	CLIID        string
	SecretName   string
}

func (s *CredentialManagementService) ReadRuntimeProjection(ctx context.Context, credentialID string) (RuntimeProjection, error) {
	if s == nil {
		return RuntimeProjection{}, fmt.Errorf("platformk8s: credential service is nil")
	}
	credentialID = strings.TrimSpace(credentialID)
	if credentialID == "" {
		return RuntimeProjection{}, domainerror.NewValidation("platformk8s: credential id is empty")
	}
	resource, err := s.store.Get(ctx, credentialID)
	if err != nil {
		if apierrors.IsNotFound(err) {
			return RuntimeProjection{}, domainerror.NewNotFound("platformk8s: credential %q not found", credentialID)
		}
		return RuntimeProjection{}, fmt.Errorf("platformk8s: get credential %q: %w", credentialID, err)
	}
	definition, err := credentialsDefinitionFromResource(resource)
	if err != nil {
		return RuntimeProjection{}, err
	}
	return RuntimeProjection{
		CredentialID: definition.GetCredentialId(),
		Kind:         definition.GetKind(),
		VendorID:     strings.TrimSpace(definition.GetVendorId()),
		CLIID:        strings.TrimSpace(definition.GetOauthMetadata().GetCliId()),
		SecretName:   credentialSecretName(resource),
	}, nil
}

func credentialSecretName(resource *platformv1alpha1.CredentialDefinitionResource) string {
	if resource == nil {
		return ""
	}
	if source := resource.Spec.SecretSource; source != nil && strings.TrimSpace(source.Name) != "" {
		return strings.TrimSpace(source.Name)
	}
	return strings.TrimSpace(resource.Name)
}
