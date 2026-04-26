package credentials

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	credentialv1 "code-code.internal/go-contract/credential/v1"
	credentialcontract "code-code.internal/platform-contract/credential"
	clioauth "code-code.internal/platform-k8s/clidefinitions/oauth"
	clisupport "code-code.internal/platform-k8s/clidefinitions/support"
	"code-code.internal/platform-k8s/internal/resourcemeta"
	"code-code.internal/platform-k8s/internal/resourceops"
	"code-code.internal/platform-k8s/outboundhttp"
	"google.golang.org/protobuf/types/known/timestamppb"
	corev1 "k8s.io/api/core/v1"
	ctrlclient "sigs.k8s.io/controller-runtime/pkg/client"
)

type oauthImportHTTPClientFactory interface {
	NewClient(ctx context.Context) (*http.Client, error)
}

// OAuthCredentialImporter stores CLI-owned OAuth artifacts as platform-owned credentials.
type OAuthCredentialImporter struct {
	credentials       *CredentialManagementService
	cliSupport        *clisupport.ManagementService
	httpClientFactory oauthImportHTTPClientFactory
	namespace         string
}

// NewOAuthCredentialImporter creates one Kubernetes-backed OAuth credential importer.
func NewOAuthCredentialImporter(client ctrlclient.Client, namespace string) (*OAuthCredentialImporter, error) {
	credentials, err := NewCredentialManagementService(client, namespace)
	if err != nil {
		return nil, err
	}
	return NewOAuthCredentialImporterWithCredentialService(client, namespace, credentials)
}

func NewOAuthCredentialImporterWithStore(client ctrlclient.Client, namespace string, store ResourceStore) (*OAuthCredentialImporter, error) {
	credentials, err := NewCredentialManagementServiceWithStore(client, namespace, store)
	if err != nil {
		return nil, err
	}
	return NewOAuthCredentialImporterWithCredentialService(client, namespace, credentials)
}

func NewOAuthCredentialImporterWithCredentialService(client ctrlclient.Client, namespace string, credentials *CredentialManagementService) (*OAuthCredentialImporter, error) {
	if credentials == nil {
		return nil, fmt.Errorf("platformk8s: credential service is nil")
	}
	cliSupport, err := clisupport.NewManagementService()
	if err != nil {
		return nil, err
	}
	return &OAuthCredentialImporter{
		credentials:       credentials,
		cliSupport:        cliSupport,
		httpClientFactory: outboundhttp.NewClientFactory(),
		namespace:         namespace,
	}, nil
}

// ImportOAuthCredential stores one OAuth artifact as one platform-owned OAuth credential.
func (i *OAuthCredentialImporter) ImportOAuthCredential(ctx context.Context, request *credentialcontract.OAuthImportRequest) (*credentialcontract.CredentialDefinition, error) {
	if err := credentialcontract.ValidateOAuthImportRequest(request); err != nil {
		return nil, err
	}
	if i == nil || i.credentials == nil || i.cliSupport == nil {
		return nil, fmt.Errorf("platformk8s: oauth credential importer is not initialized")
	}

	cliID := strings.TrimSpace(string(request.CliID))
	cli, err := i.cliSupport.Get(ctx, cliID)
	if err != nil {
		return nil, fmt.Errorf("platformk8s: resolve cli support %q: %w", cliID, err)
	}
	projectedArtifact, err := clioauth.ResolveOAuthProjection(cli, &request.Artifact)
	if err != nil {
		return nil, fmt.Errorf("platformk8s: resolve cli oauth projection for %q: %w", cliID, err)
	}

	credential, err := credentialFromOAuthImport(request, cli.GetVendorId(), *projectedArtifact)
	if err != nil {
		return nil, err
	}
	resource := credential.Resource(i.namespace)
	secret, err := credential.Secret(i.namespace)
	if err != nil {
		return nil, err
	}
	// Set OAuthMetadata on the definition (metadata lives in CRD, not Secret).
	resource.Spec.Definition.KindMetadata = &credentialv1.CredentialDefinition_OauthMetadata{
		OauthMetadata: &credentialv1.OAuthMetadata{
			CliId: cliID,
		},
	}
	applyOAuthArtifactSecretData(secret, request.CliID, *projectedArtifact)
	if err := i.applySpecializedOAuthSecretData(ctx, secret, request, projectedArtifact); err != nil {
		return nil, err
	}

	resourcemeta.SetDisplayNameAnnotation(resource, request.DisplayName)

	if err := resourceops.UpsertResource(ctx, i.credentials.client, secret, i.namespace, secret.Name); err != nil {
		return nil, err
	}
	if err := resourceops.UpsertResource(ctx, i.credentials.client, resource, i.namespace, resource.Name); err != nil {
		return nil, err
	}

	return &credentialcontract.CredentialDefinition{
		CredentialId: resource.Spec.Definition.CredentialId,
		DisplayName:  resource.Spec.Definition.DisplayName,
		Kind:         credentialv1.CredentialKind_CREDENTIAL_KIND_OAUTH,
	}, nil
}

func credentialFromOAuthImport(
	request *credentialcontract.OAuthImportRequest,
	vendorID string,
	artifact credentialcontract.OAuthArtifact,
) (*Credential, error) {
	definition := &credentialv1.CredentialDefinition{
		CredentialId: request.CredentialID,
		DisplayName:  request.DisplayName,
		Kind:         credentialv1.CredentialKind_CREDENTIAL_KIND_OAUTH,
		Purpose:      credentialv1.CredentialPurpose_CREDENTIAL_PURPOSE_DATA_PLANE,
		VendorId:     strings.TrimSpace(vendorID),
		KindMetadata: &credentialv1.CredentialDefinition_OauthMetadata{
			OauthMetadata: &credentialv1.OAuthMetadata{
				CliId: strings.TrimSpace(string(request.CliID)),
			},
		},
	}
	material := &credentialv1.ResolvedCredential{
		CredentialId: request.CredentialID,
		Kind:         credentialv1.CredentialKind_CREDENTIAL_KIND_OAUTH,
		Material: &credentialv1.ResolvedCredential_Oauth{
			Oauth: &credentialv1.OAuthCredential{
				AccessToken:  strings.TrimSpace(artifact.AccessToken),
				TokenType:    strings.TrimSpace(artifact.TokenType),
				AccountId:    strings.TrimSpace(artifact.AccountID),
				Scopes:       append([]string(nil), artifact.Scopes...),
				RefreshToken: strings.TrimSpace(artifact.RefreshToken),
				IdToken:      strings.TrimSpace(artifact.IDToken),
			},
		},
	}
	if artifact.ExpiresAt != nil {
		material.GetOauth().ExpiresAt = timestamppb.New(artifact.ExpiresAt.UTC())
	}
	return NewCredential(definition, material)
}

func applyOAuthArtifactSecretData(secret *corev1.Secret, cliID credentialcontract.OAuthCLIID, artifact credentialcontract.OAuthArtifact) {
	if secret == nil {
		return
	}
	if secret.StringData == nil {
		secret.StringData = map[string]string{}
	}
	secret.StringData[oauthCLIIDSecretKey] = strings.ToLower(strings.TrimSpace(string(cliID)))
	if tokenType := strings.TrimSpace(artifact.TokenType); tokenType != "" {
		secret.StringData[secretKeyTokenType] = tokenType
	}
	if accountID := strings.TrimSpace(artifact.AccountID); accountID != "" {
		secret.StringData[secretKeyAccountID] = accountID
	}
	if token := strings.TrimSpace(artifact.RefreshToken); token != "" {
		secret.StringData[refreshTokenSecretKey] = token
	}
	if token := strings.TrimSpace(artifact.IDToken); token != "" {
		secret.StringData[idTokenSecretKey] = token
	}
	if raw := strings.TrimSpace(artifact.TokenResponseJSON); raw != "" {
		secret.StringData[tokenResponseSecretKey] = raw
	}
	if email := strings.TrimSpace(artifact.AccountEmail); email != "" {
		secret.StringData[accountEmailSecretKey] = email
	}
}
