package credentials

import (
	"strings"
	"time"

	credentialv1 "code-code.internal/go-contract/credential/v1"
	"code-code.internal/go-contract/domainerror"
	"google.golang.org/protobuf/types/known/timestamppb"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func (c *Credential) Secret(namespace string) (*corev1.Secret, error) {
	if c == nil || c.definition == nil {
		return nil, domainerror.NewValidation("platformk8s/credentials: credential is nil")
	}
	if err := validateCredentialMaterial(c.definition, c.material); err != nil {
		return nil, err
	}
	if c.material == nil {
		return nil, domainerror.NewValidation("platformk8s/credentials: credential material is required")
	}
	secret := &corev1.Secret{
		TypeMeta: metav1.TypeMeta{APIVersion: "v1", Kind: "Secret"},
		ObjectMeta: metav1.ObjectMeta{
			Name:      c.ID(),
			Namespace: namespace,
		},
		StringData: map[string]string{},
	}
	switch c.definition.GetKind() {
	case credentialv1.CredentialKind_CREDENTIAL_KIND_API_KEY:
		secret.StringData[secretKeyAPIKey] = c.material.GetApiKey().GetApiKey()
	case credentialv1.CredentialKind_CREDENTIAL_KIND_OAUTH:
		oauth := c.material.GetOauth()
		secret.StringData[secretKeyAccessToken] = oauth.GetAccessToken()
		if oauth.GetTokenType() != "" {
			secret.StringData[secretKeyTokenType] = oauth.GetTokenType()
		}
		if oauth.GetAccountId() != "" {
			secret.StringData[secretKeyAccountID] = oauth.GetAccountId()
		}
		if len(oauth.GetScopes()) > 0 {
			secret.StringData[secretKeyScopes] = strings.Join(trimNonEmpty(oauth.GetScopes()), ",")
		}
		if expiresAt := oauth.GetExpiresAt(); expiresAt != nil {
			secret.StringData[secretKeyExpiresAt] = expiresAt.AsTime().UTC().Format(time.RFC3339)
		}
		if oauth.GetRefreshToken() != "" {
			secret.StringData[refreshTokenSecretKey] = oauth.GetRefreshToken()
		}
		if oauth.GetIdToken() != "" {
			secret.StringData[idTokenSecretKey] = oauth.GetIdToken()
		}
	case credentialv1.CredentialKind_CREDENTIAL_KIND_SESSION:
		for key, value := range c.material.GetSession().GetValues() {
			key = strings.TrimSpace(key)
			value = strings.TrimSpace(value)
			if key == "" || value == "" {
				continue
			}
			secret.StringData[key] = value
		}
	default:
		return nil, domainerror.NewValidation("platformk8s/credentials: unsupported credential kind %q", c.definition.GetKind().String())
	}
	return secret, nil
}

func (c *Credential) PreserveMissingMaterial(secret *corev1.Secret) {
	if c == nil || c.definition == nil || secret == nil {
		return
	}
	switch c.definition.GetKind() {
	case credentialv1.CredentialKind_CREDENTIAL_KIND_API_KEY:
		if c.material == nil {
			c.material = &credentialv1.ResolvedCredential{CredentialId: c.ID(), Kind: c.definition.GetKind()}
		}
		if c.material.Material == nil || c.material.GetApiKey().GetApiKey() == "" {
			c.material.Material = &credentialv1.ResolvedCredential_ApiKey{
				ApiKey: &credentialv1.ApiKeyCredential{
					ApiKey: strings.TrimSpace(string(secret.Data[secretKeyAPIKey])),
				},
			}
		}
	case credentialv1.CredentialKind_CREDENTIAL_KIND_OAUTH:
		if c.material == nil {
			c.material = &credentialv1.ResolvedCredential{
				CredentialId: c.ID(),
				Kind:         c.definition.GetKind(),
				Material:     &credentialv1.ResolvedCredential_Oauth{Oauth: &credentialv1.OAuthCredential{}},
			}
		}
		if c.material.GetOauth() == nil {
			c.material.Material = &credentialv1.ResolvedCredential_Oauth{Oauth: &credentialv1.OAuthCredential{}}
		}
		oauth := c.material.GetOauth()
		if oauth.GetAccessToken() == "" {
			oauth.AccessToken = strings.TrimSpace(string(secret.Data[secretKeyAccessToken]))
		}
		if oauth.GetTokenType() == "" {
			oauth.TokenType = strings.TrimSpace(string(secret.Data[secretKeyTokenType]))
		}
		if oauth.GetAccountId() == "" {
			oauth.AccountId = strings.TrimSpace(string(secret.Data[secretKeyAccountID]))
		}
		if len(oauth.GetScopes()) == 0 {
			oauth.Scopes = trimNonEmpty(strings.Split(strings.TrimSpace(string(secret.Data[secretKeyScopes])), ","))
		}
		if oauth.GetExpiresAt() == nil {
			if raw := strings.TrimSpace(string(secret.Data[secretKeyExpiresAt])); raw != "" {
				if parsed, err := time.Parse(time.RFC3339, raw); err == nil {
					oauth.ExpiresAt = timestamppb.New(parsed)
				}
			}
		}
		if oauth.GetRefreshToken() == "" {
			oauth.RefreshToken = strings.TrimSpace(string(secret.Data[refreshTokenSecretKey]))
		}
		if oauth.GetIdToken() == "" {
			oauth.IdToken = strings.TrimSpace(string(secret.Data[idTokenSecretKey]))
		}
	case credentialv1.CredentialKind_CREDENTIAL_KIND_SESSION:
		if c.material == nil {
			c.material = &credentialv1.ResolvedCredential{
				CredentialId: c.ID(),
				Kind:         c.definition.GetKind(),
				Material: &credentialv1.ResolvedCredential_Session{
					Session: &credentialv1.SessionCredential{},
				},
			}
		}
		if c.material.GetSession() == nil {
			c.material.Material = &credentialv1.ResolvedCredential_Session{Session: &credentialv1.SessionCredential{}}
		}
		session := c.material.GetSession()
		if session.GetSchemaId() == "" {
			if metadata := c.definition.GetSessionMetadata(); metadata != nil {
				session.SchemaId = strings.TrimSpace(metadata.GetSchemaId())
			}
		}
		if len(session.GetValues()) == 0 {
			session.Values = sessionValuesFromSecret(secret)
		}
	}
}

func sessionValuesFromSecret(secret *corev1.Secret) map[string]string {
	if secret == nil || len(secret.Data) == 0 {
		return nil
	}
	values := make(map[string]string, len(secret.Data))
	for key, value := range secret.Data {
		key = strings.TrimSpace(key)
		if key == "" {
			continue
		}
		trimmed := strings.TrimSpace(string(value))
		if trimmed == "" {
			continue
		}
		values[key] = trimmed
	}
	if len(values) == 0 {
		return nil
	}
	return values
}
