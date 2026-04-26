package credentials

import (
	"context"
	"strings"

	credentialcontract "code-code.internal/platform-contract/credential"
	"code-code.internal/platform-k8s/clidefinitions/codeassist"
	corev1 "k8s.io/api/core/v1"
)

func init() {
	registerOAuthSecretDataApplier("gemini-cli", (*OAuthCredentialImporter).applyGeminiOAuthSecretData)
}

func (i *OAuthCredentialImporter) applyGeminiOAuthSecretData(
	ctx context.Context,
	secret *corev1.Secret,
	request *credentialcontract.OAuthImportRequest,
	artifact *credentialcontract.OAuthArtifact,
) error {
	projectID := i.existingOAuthSecretValue(ctx, strings.TrimSpace(request.CredentialID), projectIDSecretKey)
	tierName := i.existingOAuthSecretValue(ctx, strings.TrimSpace(request.CredentialID), tierNameSecretKey)
	if strings.TrimSpace(artifact.AccessToken) != "" && i.httpClientFactory != nil {
		httpClient, err := i.httpClientFactory.NewClient(ctx)
		if err == nil {
			payload, err := codeassist.LoadGeminiCodeAssist(ctx, httpClient, artifact.AccessToken, projectID)
			if err == nil {
				if resolvedProjectID := codeassist.GeminiProjectID(payload); resolvedProjectID != "" {
					projectID = resolvedProjectID
				}
				if resolvedTierName := codeassist.GeminiTierName(payload); resolvedTierName != "" {
					tierName = resolvedTierName
				}
			}
		}
	}
	applyGoogleOAuthSecretData(secret, projectID, tierName)
	return nil
}
