package credentials

import (
	"fmt"
	"time"

	credentialcontract "code-code.internal/platform-contract/credential"
	corev1 "k8s.io/api/core/v1"
)

// OAuthArtifactFromSecret materializes one OAuth artifact from a credential Secret.
func OAuthArtifactFromSecret(secret *corev1.Secret) (*credentialcontract.OAuthArtifact, error) {
	if secret == nil {
		return nil, fmt.Errorf("platformk8s/credentials: oauth secret is nil")
	}
	artifact := &credentialcontract.OAuthArtifact{
		AccessToken:       getOptionalSecretValue(secret, secretKeyAccessToken),
		RefreshToken:      getOptionalSecretValue(secret, refreshTokenSecretKey),
		IDToken:           getOptionalSecretValue(secret, idTokenSecretKey),
		TokenResponseJSON: getOptionalSecretValue(secret, tokenResponseSecretKey),
		TokenType:         getOptionalSecretValue(secret, secretKeyTokenType),
		AccountID:         getOptionalSecretValue(secret, secretKeyAccountID),
		AccountEmail:      getOptionalSecretValue(secret, accountEmailSecretKey),
		Scopes:            parseScopes(getOptionalSecretValue(secret, secretKeyScopes)),
	}
	if raw := getOptionalSecretValue(secret, secretKeyExpiresAt); raw != "" {
		expiresAt, err := time.Parse(time.RFC3339, raw)
		if err != nil {
			return nil, fmt.Errorf("platformk8s/credentials: parse oauth expires_at: %w", err)
		}
		artifact.ExpiresAt = &expiresAt
	}
	if err := credentialcontract.ValidateOAuthArtifact(artifact); err != nil {
		return nil, fmt.Errorf("platformk8s/credentials: invalid oauth artifact secret: %w", err)
	}
	return artifact, nil
}
