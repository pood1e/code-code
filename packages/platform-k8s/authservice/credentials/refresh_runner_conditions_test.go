package credentials

import (
	"context"
	"encoding/base64"
	"testing"
	"time"

	credentialv1 "code-code.internal/go-contract/credential/v1"
	platformv1alpha1 "code-code.internal/platform-k8s/api/v1alpha1"
	"code-code.internal/platform-k8s/internal/testutil"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
	ctrlclientfake "sigs.k8s.io/controller-runtime/pkg/client/fake"
)

func TestRefreshRunnerSetsRefreshConditionOnSuccess(t *testing.T) {
	ctx := context.Background()
	expiresSoon := time.Now().UTC().Add(time.Minute)
	nextExpiry := time.Now().UTC().Add(time.Hour)

	credential := newRefreshTestCredential("credential-codex", "codex", 2)
	secret := newRefreshTestSecret("credential-codex", expiresSoon)

	client := ctrlclientfake.NewClientBuilder().
		WithScheme(testutil.NewScheme()).
		WithObjects(credential, secret).
		WithStatusSubresource(&platformv1alpha1.CredentialDefinitionResource{}).
		Build()
	runner, err := NewRefreshRunner(RefreshRunnerConfig{
		Client:    client,
		Namespace: "code-code",
		Refreshers: []OAuthTokenRefresher{staticRefresher{
			cliID: "codex",
			result: &OAuthRefreshResult{
				AccessToken:  "new-access",
				RefreshToken: "new-refresh",
				ExpiresAt:    &nextExpiry,
			},
		}},
	})
	if err != nil {
		t.Fatalf("NewRefreshRunner() error = %v", err)
	}

	if err := runner.RunAll(ctx); err != nil {
		t.Fatalf("RunAll() error = %v", err)
	}

	updated := &platformv1alpha1.CredentialDefinitionResource{}
	if err := client.Get(ctx, types.NamespacedName{Namespace: "code-code", Name: "credential-codex"}, updated); err != nil {
		t.Fatalf("get credential: %v", err)
	}
	assertRefreshTestCondition(t, updated.Status.Conditions, ConditionOAuthRefreshReady, metav1.ConditionTrue, "RefreshSucceeded")
}

func newRefreshTestCredential(name, cliID string, generation int64) *platformv1alpha1.CredentialDefinitionResource {
	return &platformv1alpha1.CredentialDefinitionResource{
		TypeMeta: metav1.TypeMeta{APIVersion: platformv1alpha1.GroupVersion.String(), Kind: platformv1alpha1.KindCredentialDefinitionResource},
		ObjectMeta: metav1.ObjectMeta{
			Name:       name,
			Namespace:  "code-code",
			Generation: generation,
		},
		Spec: platformv1alpha1.CredentialDefinitionResourceSpec{
			Definition: &credentialv1.CredentialDefinition{
				CredentialId: name,
				DisplayName:  name,
				Kind:         credentialv1.CredentialKind_CREDENTIAL_KIND_OAUTH,
				KindMetadata: &credentialv1.CredentialDefinition_OauthMetadata{
					OauthMetadata: &credentialv1.OAuthMetadata{CliId: cliID},
				},
			},
		},
		Status: platformv1alpha1.CredentialDefinitionResourceStatus{
			OAuth: &platformv1alpha1.CredentialOAuthStatus{CredentialGeneration: 1},
		},
	}
}

func newRefreshTestSecret(name string, expiresAt time.Time) *corev1.Secret {
	return &corev1.Secret{
		ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: "code-code"},
		Data: map[string][]byte{
			"refresh_token": []byte("old-refresh"),
			"access_token":  []byte("old-access"),
			"expires_at":    []byte(expiresAt.Format(time.RFC3339)),
			"id_token":      []byte(testOpenAIIDToken()),
		},
	}
}

func testOpenAIIDToken() string {
	payload := `{"sub":"acct-sub","email":"dev@example.com","https://api.openai.com/auth":{"chatgpt_account_id":"acct-1"}}`
	return "header." + base64.RawURLEncoding.EncodeToString([]byte(payload)) + ".sig"
}

func assertRefreshTestCondition(
	t *testing.T,
	conditions []metav1.Condition,
	conditionType string,
	status metav1.ConditionStatus,
	reason string,
) *metav1.Condition {
	t.Helper()
	condition := meta.FindStatusCondition(conditions, conditionType)
	if condition == nil {
		t.Fatalf("condition %q not found", conditionType)
	}
	if condition.Status != status {
		t.Fatalf("condition %q status = %q, want %q", conditionType, condition.Status, status)
	}
	if condition.Reason != reason {
		t.Fatalf("condition %q reason = %q, want %q", conditionType, condition.Reason, reason)
	}
	return condition
}
