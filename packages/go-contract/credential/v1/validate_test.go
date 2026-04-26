package credentialv1

import (
	"testing"

	"google.golang.org/protobuf/types/known/timestamppb"
)

func TestValidateRefRejectsEmptyID(t *testing.T) {
	t.Parallel()

	ref := &CredentialRef{
		CredentialId: "",
	}

	if err := ValidateRef(ref); err == nil {
		t.Fatal("ValidateRef() expected error, got nil")
	}
}

func TestValidateDefinitionRejectsUnspecifiedKind(t *testing.T) {
	t.Parallel()

	definition := &CredentialDefinition{
		CredentialId: "credential-1",
	}

	if err := ValidateDefinition(definition); err == nil {
		t.Fatal("ValidateDefinition() expected error, got nil")
	}
}

func TestValidateResolvedCredentialAcceptsAPIKey(t *testing.T) {
	t.Parallel()

	resolved := &ResolvedCredential{
		CredentialId: "credential-1",
		Kind:         CredentialKind_CREDENTIAL_KIND_API_KEY,
		Material: &ResolvedCredential_ApiKey{
			ApiKey: &ApiKeyCredential{
				ApiKey: "secret",
			},
		},
	}

	if err := ValidateResolvedCredential(resolved); err != nil {
		t.Fatalf("ValidateResolvedCredential() error = %v", err)
	}
}

func TestValidateResolvedCredentialRejectsEmptyOAuthToken(t *testing.T) {
	t.Parallel()

	resolved := &ResolvedCredential{
		CredentialId: "credential-2",
		Kind:         CredentialKind_CREDENTIAL_KIND_OAUTH,
		Material: &ResolvedCredential_Oauth{
			Oauth: &OAuthCredential{},
		},
	}

	if err := ValidateResolvedCredential(resolved); err == nil {
		t.Fatal("ValidateResolvedCredential() expected error, got nil")
	}
}

func TestValidateResolvedCredentialRejectsInvalidOAuthExpiry(t *testing.T) {
	t.Parallel()

	resolved := &ResolvedCredential{
		CredentialId: "credential-2",
		Kind:         CredentialKind_CREDENTIAL_KIND_OAUTH,
		Material: &ResolvedCredential_Oauth{
			Oauth: &OAuthCredential{
				AccessToken: "token",
				ExpiresAt:   &timestamppb.Timestamp{Seconds: 1, Nanos: 1000000000},
			},
		},
	}

	if err := ValidateResolvedCredential(resolved); err == nil {
		t.Fatal("ValidateResolvedCredential() expected error, got nil")
	}
}

func TestValidateResolvedCredentialAcceptsSession(t *testing.T) {
	t.Parallel()

	resolved := &ResolvedCredential{
		CredentialId: "credential-3",
		Kind:         CredentialKind_CREDENTIAL_KIND_SESSION,
		Material: &ResolvedCredential_Session{
			Session: &SessionCredential{
				SchemaId: "google-ai-studio",
				Values: map[string]string{
					"cookie": "SAPISID=abc",
				},
			},
		},
	}

	if err := ValidateResolvedCredential(resolved); err != nil {
		t.Fatalf("ValidateResolvedCredential() error = %v", err)
	}
}

func TestValidateResolvedCredentialRejectsEmptySessionSchema(t *testing.T) {
	t.Parallel()

	resolved := &ResolvedCredential{
		CredentialId: "credential-4",
		Kind:         CredentialKind_CREDENTIAL_KIND_SESSION,
		Material: &ResolvedCredential_Session{
			Session: &SessionCredential{
				Values: map[string]string{
					"cookie": "SAPISID=abc",
				},
			},
		},
	}

	if err := ValidateResolvedCredential(resolved); err == nil {
		t.Fatal("ValidateResolvedCredential() expected error, got nil")
	}
}
