package credentials

import (
	"context"
	"fmt"
	"strings"
	"time"

	credentialv1 "code-code.internal/go-contract/credential/v1"
	credentialcontract "code-code.internal/platform-contract/credential"
	platformv1alpha1 "code-code.internal/platform-k8s/api/v1alpha1"
	clioauth "code-code.internal/platform-k8s/clidefinitions/oauth"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func (r *RefreshRunner) refreshedOAuthArtifact(
	ctx context.Context,
	cliID string,
	secret *corev1.Secret,
	result *OAuthRefreshResult,
	definition *credentialv1.CredentialDefinition,
	currentStatus *platformv1alpha1.CredentialOAuthStatus,
	now time.Time,
	refreshLead time.Duration,
) (*credentialcontract.OAuthArtifact, *platformv1alpha1.CredentialOAuthStatus, error) {
	artifact := mergeRefreshResultWithSecret(secret, result)
	status := r.oauthStatusFromDefinition(definition, currentStatus)
	status.CredentialGeneration++
	status.LastRefreshedAt = &metav1.Time{Time: now}
	nextRefreshAfter := nextOAuthRefreshAfter(
		artifact.ExpiresAt,
		refreshLead,
	)
	if nextRefreshAfter != nil {
		status.NextRefreshAfter = &metav1.Time{Time: *nextRefreshAfter}
	} else {
		status.NextRefreshAfter = nil
	}

	if r == nil || r.cliSupport == nil {
		if artifact.AccountEmail != "" {
			status.AccountEmail = artifact.AccountEmail
		}
		return artifact, status, fmt.Errorf("credentials: cli support service is not initialized")
	}
	cli, err := r.cliSupport.Get(ctx, strings.TrimSpace(cliID))
	if err != nil {
		if artifact.AccountEmail != "" {
			status.AccountEmail = artifact.AccountEmail
		}
		return artifact, status, fmt.Errorf("credentials: resolve cli support %q: %w", cliID, err)
	}
	projectedArtifact, err := clioauth.ResolveOAuthProjection(cli, artifact)
	if err != nil {
		if artifact.AccountEmail != "" {
			status.AccountEmail = artifact.AccountEmail
		}
		return artifact, status, fmt.Errorf("credentials: resolve cli oauth projection for %q: %w", cliID, err)
	}
	if projectedArtifact.AccountEmail != "" {
		status.AccountEmail = projectedArtifact.AccountEmail
	}
	return projectedArtifact, status, nil
}

func mergeRefreshResultWithSecret(secret *corev1.Secret, result *OAuthRefreshResult) *credentialcontract.OAuthArtifact {
	artifact := &credentialcontract.OAuthArtifact{
		AccessToken:       strings.TrimSpace(result.AccessToken),
		RefreshToken:      secretValueOr(result.RefreshToken, secret, refreshTokenSecretKey),
		IDToken:           secretValueOr(result.IDToken, secret, idTokenSecretKey),
		TokenResponseJSON: secretValueOr(result.TokenResponseJSON, secret, tokenResponseSecretKey),
		TokenType:         secretValueOr(result.TokenType, secret, secretKeyTokenType),
		AccountID:         secretValueOr(result.AccountID, secret, secretKeyAccountID),
		AccountEmail:      secretValueOr(result.AccountEmail, secret, accountEmailSecretKey),
		Scopes:            scopesOr(result.Scopes, secret),
		ExpiresAt:         expiresAtOr(result.ExpiresAt, secret),
	}
	return artifact
}

func secretValueOr(next string, secret *corev1.Secret, key string) string {
	trimmed := strings.TrimSpace(next)
	if trimmed != "" {
		return trimmed
	}
	if secret == nil {
		return ""
	}
	return strings.TrimSpace(string(secret.Data[key]))
}

func scopesOr(next []string, secret *corev1.Secret) []string {
	if len(next) > 0 {
		return append([]string(nil), next...)
	}
	if secret == nil {
		return nil
	}
	return parseScopes(strings.TrimSpace(string(secret.Data[secretKeyScopes])))
}

func expiresAtOr(next *time.Time, secret *corev1.Secret) *time.Time {
	if next != nil && !next.IsZero() {
		value := next.UTC()
		return &value
	}
	if secret == nil {
		return nil
	}
	raw := strings.TrimSpace(string(secret.Data[secretKeyExpiresAt]))
	if raw == "" {
		return nil
	}
	parsed, err := time.Parse(time.RFC3339, raw)
	if err != nil {
		return nil
	}
	value := parsed.UTC()
	return &value
}
