package credentials

import (
	"context"
	"strings"

	credentialcontract "code-code.internal/platform-contract/credential"
	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/types"
)

type oauthSecretDataApplier func(
	importer *OAuthCredentialImporter,
	ctx context.Context,
	secret *corev1.Secret,
	request *credentialcontract.OAuthImportRequest,
	artifact *credentialcontract.OAuthArtifact,
) error

var oauthSecretDataAppliers = map[string]oauthSecretDataApplier{}

func registerOAuthSecretDataApplier(cliID string, applier oauthSecretDataApplier) {
	trimmedCLIID := strings.TrimSpace(cliID)
	if trimmedCLIID == "" || applier == nil {
		return
	}
	oauthSecretDataAppliers[trimmedCLIID] = applier
}

func (i *OAuthCredentialImporter) applySpecializedOAuthSecretData(
	ctx context.Context,
	secret *corev1.Secret,
	request *credentialcontract.OAuthImportRequest,
	artifact *credentialcontract.OAuthArtifact,
) error {
	if i == nil || secret == nil || request == nil || artifact == nil {
		return nil
	}
	cliID := strings.TrimSpace(string(request.CliID))
	if applier, ok := oauthSecretDataAppliers[cliID]; ok {
		return applier(i, ctx, secret, request, artifact)
	}
	return nil
}

func applyGoogleOAuthSecretData(secret *corev1.Secret, projectID string, tierName string) {
	if secret == nil {
		return
	}
	if strings.TrimSpace(projectID) == "" && strings.TrimSpace(tierName) == "" {
		return
	}
	if secret.StringData == nil {
		secret.StringData = map[string]string{}
	}
	if strings.TrimSpace(projectID) != "" {
		secret.StringData[projectIDSecretKey] = projectID
	}
	if strings.TrimSpace(tierName) != "" {
		secret.StringData[tierNameSecretKey] = tierName
	}
}

func (i *OAuthCredentialImporter) existingOAuthSecretValue(ctx context.Context, credentialID string, secretKey string) string {
	if i == nil || i.credentials == nil || i.credentials.client == nil || strings.TrimSpace(credentialID) == "" {
		return ""
	}
	secret := &corev1.Secret{}
	err := i.credentials.client.Get(ctx, types.NamespacedName{
		Namespace: i.namespace,
		Name:      strings.TrimSpace(credentialID),
	}, secret)
	if err != nil {
		if apierrors.IsNotFound(err) {
			return ""
		}
		return ""
	}
	return getOptionalSecretValue(secret, secretKey)
}
