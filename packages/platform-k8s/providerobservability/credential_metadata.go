package providerobservability

import (
	"strings"
	"time"

	authv1 "code-code.internal/go-contract/platform/auth/v1"
)

const (
	accountIDSecretKey = "account_id"
	projectIDSecretKey = "project_id"
	tierNameSecretKey  = "tier_name"
)

func credentialSecretName(projection *authv1.CredentialRuntimeProjection) string {
	if projection == nil {
		return ""
	}
	if secretName := strings.TrimSpace(projection.GetSecretName()); secretName != "" {
		return secretName
	}
	return strings.TrimSpace(projection.GetCredentialId())
}

func timePointerCopy(value *time.Time) *time.Time {
	if value == nil {
		return nil
	}
	copy := value.UTC()
	return &copy
}
