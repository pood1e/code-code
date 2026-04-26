package credentialv1

import "fmt"

// ValidateRef validates one credential reference.
func ValidateRef(ref *CredentialRef) error {
	if ref == nil {
		return fmt.Errorf("credentialv1: credential ref is nil")
	}
	if ref.CredentialId == "" {
		return fmt.Errorf("credentialv1: credential ref id is empty")
	}
	return nil
}

// ValidateDefinition validates one credential definition.
func ValidateDefinition(definition *CredentialDefinition) error {
	if definition == nil {
		return fmt.Errorf("credentialv1: credential definition is nil")
	}
	if definition.CredentialId == "" {
		return fmt.Errorf("credentialv1: credential definition id is empty")
	}
	if definition.Kind == CredentialKind_CREDENTIAL_KIND_UNSPECIFIED {
		return fmt.Errorf("credentialv1: credential definition kind is unspecified")
	}
	return nil
}

// ValidateResolvedCredential validates one resolved credential.
func ValidateResolvedCredential(resolved *ResolvedCredential) error {
	if resolved == nil {
		return fmt.Errorf("credentialv1: resolved credential is nil")
	}
	if resolved.CredentialId == "" {
		return fmt.Errorf("credentialv1: resolved credential id is empty")
	}
	if resolved.Kind == CredentialKind_CREDENTIAL_KIND_UNSPECIFIED {
		return fmt.Errorf("credentialv1: resolved credential kind is unspecified")
	}

	switch resolved.Kind {
	case CredentialKind_CREDENTIAL_KIND_API_KEY:
		if resolved.GetApiKey() == nil {
			return fmt.Errorf("credentialv1: resolved api key credential is missing material")
		}
		if resolved.GetOauth() != nil {
			return fmt.Errorf("credentialv1: resolved api key credential has unexpected oauth material")
		}
		if resolved.GetApiKey().ApiKey == "" {
			return fmt.Errorf("credentialv1: resolved api key is empty")
		}
	case CredentialKind_CREDENTIAL_KIND_OAUTH:
		if resolved.GetOauth() == nil {
			return fmt.Errorf("credentialv1: resolved oauth credential is missing material")
		}
		if resolved.GetApiKey() != nil {
			return fmt.Errorf("credentialv1: resolved oauth credential has unexpected api key material")
		}
		if resolved.GetOauth().AccessToken == "" {
			return fmt.Errorf("credentialv1: resolved oauth access token is empty")
		}
		if resolved.GetOauth().ExpiresAt != nil && !resolved.GetOauth().ExpiresAt.IsValid() {
			return fmt.Errorf("credentialv1: resolved oauth expires_at is invalid")
		}
	case CredentialKind_CREDENTIAL_KIND_SESSION:
		if resolved.GetSession() == nil {
			return fmt.Errorf("credentialv1: resolved session credential is missing material")
		}
		if resolved.GetApiKey() != nil || resolved.GetOauth() != nil {
			return fmt.Errorf("credentialv1: resolved session credential has unexpected material")
		}
		if resolved.GetSession().SchemaId == "" {
			return fmt.Errorf("credentialv1: resolved session schema_id is empty")
		}
		if len(resolved.GetSession().GetValues()) == 0 {
			return fmt.Errorf("credentialv1: resolved session values are empty")
		}
	default:
		return fmt.Errorf("credentialv1: resolved credential kind %d is invalid", resolved.Kind)
	}

	return nil
}
