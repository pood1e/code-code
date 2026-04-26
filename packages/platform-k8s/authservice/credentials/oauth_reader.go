package credentials

import (
	"context"
	"fmt"
	"strings"

	credentialcontract "code-code.internal/platform-contract/credential"
	corev1 "k8s.io/api/core/v1"
	ctrlclient "sigs.k8s.io/controller-runtime/pkg/client"
)

func (s *CredentialManagementService) ReadOAuthArtifact(ctx context.Context, credentialID string) (*credentialcontract.OAuthArtifact, error) {
	if s == nil {
		return nil, fmt.Errorf("platformk8s: credential service is nil")
	}
	credentialID = strings.TrimSpace(credentialID)
	if credentialID == "" {
		return nil, fmt.Errorf("platformk8s: credential id is empty")
	}
	secret := &corev1.Secret{}
	if err := s.client.Get(ctx, ctrlclient.ObjectKey{Namespace: s.namespace, Name: credentialID}, secret); err != nil {
		return nil, fmt.Errorf("platformk8s: get oauth credential secret %q: %w", credentialID, err)
	}
	artifact, err := OAuthArtifactFromSecret(secret)
	if err != nil {
		return nil, fmt.Errorf("platformk8s: read oauth artifact %q: %w", credentialID, err)
	}
	return artifact, nil
}

func (s *CredentialManagementService) ReadSecretValue(ctx context.Context, credentialID, secretKey string) (string, error) {
	if s == nil {
		return "", fmt.Errorf("platformk8s: credential service is nil")
	}
	credentialID = strings.TrimSpace(credentialID)
	secretKey = strings.TrimSpace(secretKey)
	if credentialID == "" {
		return "", fmt.Errorf("platformk8s: credential id is empty")
	}
	if secretKey == "" {
		return "", fmt.Errorf("platformk8s: secret key is empty")
	}
	secret := &corev1.Secret{}
	if err := s.client.Get(ctx, ctrlclient.ObjectKey{Namespace: s.namespace, Name: credentialID}, secret); err != nil {
		return "", fmt.Errorf("platformk8s: get credential secret %q: %w", credentialID, err)
	}
	return getOptionalSecretValue(secret, secretKey), nil
}

func (s *CredentialManagementService) ReadSecretValues(ctx context.Context, credentialID string) (map[string]string, error) {
	if s == nil {
		return nil, fmt.Errorf("platformk8s: credential service is nil")
	}
	credentialID = strings.TrimSpace(credentialID)
	if credentialID == "" {
		return nil, fmt.Errorf("platformk8s: credential id is empty")
	}
	secret := &corev1.Secret{}
	if err := s.client.Get(ctx, ctrlclient.ObjectKey{Namespace: s.namespace, Name: credentialID}, secret); err != nil {
		return nil, fmt.Errorf("platformk8s: get credential secret %q: %w", credentialID, err)
	}
	return sessionValuesFromSecret(secret), nil
}
