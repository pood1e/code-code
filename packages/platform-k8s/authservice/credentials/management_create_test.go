package credentials

import (
	"testing"

	credentialv1 "code-code.internal/go-contract/credential/v1"
	"code-code.internal/platform-k8s/internal/testutil"
	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/types"
	ctrlclientfake "sigs.k8s.io/controller-runtime/pkg/client/fake"
)

func TestCredentialManagementServiceCreateDeletesSecretWhenResourceCreateFails(t *testing.T) {
	t.Parallel()

	const credentialID = "openai-credential"
	client := ctrlclientfake.NewClientBuilder().
		WithScheme(testutil.NewScheme()).
		WithObjects(testCredentialResource(credentialID, credentialv1.CredentialKind_CREDENTIAL_KIND_API_KEY, 1, nil)).
		Build()
	service, err := NewCredentialManagementService(client, "code-code")
	if err != nil {
		t.Fatalf("NewCredentialManagementService() error = %v", err)
	}
	credential, err := NewCredential(
		&credentialv1.CredentialDefinition{
			CredentialId: credentialID,
			DisplayName:  "OpenAI",
			Kind:         credentialv1.CredentialKind_CREDENTIAL_KIND_API_KEY,
			Purpose:      credentialv1.CredentialPurpose_CREDENTIAL_PURPOSE_DATA_PLANE,
		},
		&credentialv1.ResolvedCredential{
			Kind: credentialv1.CredentialKind_CREDENTIAL_KIND_API_KEY,
			Material: &credentialv1.ResolvedCredential_ApiKey{
				ApiKey: &credentialv1.ApiKeyCredential{ApiKey: "sk-openai"},
			},
		},
	)
	if err != nil {
		t.Fatalf("NewCredential() error = %v", err)
	}

	if _, err := service.Create(t.Context(), credential); err == nil {
		t.Fatal("Create() error = nil, want already exists")
	}
	secret := &corev1.Secret{}
	err = client.Get(t.Context(), types.NamespacedName{Namespace: "code-code", Name: credentialID}, secret)
	if !apierrors.IsNotFound(err) {
		t.Fatalf("created secret get error = %v, want not found", err)
	}
}
