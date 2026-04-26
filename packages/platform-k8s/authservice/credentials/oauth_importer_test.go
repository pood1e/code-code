package credentials

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	credentialv1 "code-code.internal/go-contract/credential/v1"
	credentialcontract "code-code.internal/platform-contract/credential"
	platformv1alpha1 "code-code.internal/platform-k8s/api/v1alpha1"
	"code-code.internal/platform-k8s/clidefinitions/codeassist"
	"code-code.internal/platform-k8s/internal/testutil"
	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
	ctrlclientfake "sigs.k8s.io/controller-runtime/pkg/client/fake"
)

const (
	geminiCLIID      = "gemini-cli"
	antigravityCLIID = "antigravity"
)

func TestOAuthRegistriesContainKnownCLIIDs(t *testing.T) {
	t.Parallel()

	if _, ok := oauthSecretDataAppliers[geminiCLIID]; !ok {
		t.Fatalf("oauthSecretDataAppliers missing %q", geminiCLIID)
	}
	if _, ok := oauthSecretDataAppliers[antigravityCLIID]; !ok {
		t.Fatalf("oauthSecretDataAppliers missing %q", antigravityCLIID)
	}
	if _, ok := oauthTokenRefresherFactories["codex"]; !ok {
		t.Fatal("oauthTokenRefresherFactories missing codex")
	}
	if _, ok := oauthTokenRefresherFactories[geminiCLIID]; !ok {
		t.Fatalf("oauthTokenRefresherFactories missing %q", geminiCLIID)
	}
	if _, ok := oauthTokenRefresherFactories[antigravityCLIID]; !ok {
		t.Fatalf("oauthTokenRefresherFactories missing %q", antigravityCLIID)
	}
}

func TestCredentialFromOAuthImport(t *testing.T) {
	t.Parallel()

	expiresAt := time.Date(2026, time.April, 13, 10, 0, 0, 0, time.UTC)
	credential, err := credentialFromOAuthImport(&credentialcontract.OAuthImportRequest{
		CliID:        "codex",
		CredentialID: "codex-oauth-main",
		DisplayName:  "Codex Main",
		Artifact: credentialcontract.OAuthArtifact{
			AccessToken:  "access-token",
			RefreshToken: "refresh-token",
			IDToken:      "id-token",
			TokenType:    "Bearer",
			AccountID:    "account-1",
			AccountEmail: "dev@example.com",
			Scopes:       []string{"openid", "email"},
			ExpiresAt:    &expiresAt,
		},
	}, "openai", credentialcontract.OAuthArtifact{
		AccessToken:  "access-token",
		RefreshToken: "refresh-token",
		IDToken:      "id-token",
		TokenType:    "Bearer",
		AccountID:    "account-1",
		AccountEmail: "dev@example.com",
		Scopes:       []string{"openid", "email"},
		ExpiresAt:    &expiresAt,
	})
	if err != nil {
		t.Fatalf("credentialFromOAuthImport() error = %v", err)
	}
	if got, want := credential.ID(), "codex-oauth-main"; got != want {
		t.Fatalf("CredentialId = %q, want %q", got, want)
	}
	if got, want := credential.Definition().GetKind(), credentialv1.CredentialKind_CREDENTIAL_KIND_OAUTH; got != want {
		t.Fatalf("Kind = %s, want %s", got, want)
	}
	if got, want := credential.Definition().GetOauthMetadata().GetCliId(), "codex"; got != want {
		t.Fatalf("CliId = %q, want %q", got, want)
	}
	if got, want := credential.Definition().GetVendorId(), "openai"; got != want {
		t.Fatalf("VendorId = %q, want %q", got, want)
	}
	mat := credential.Material().GetOauth()
	if mat == nil {
		t.Fatal("Oauth material is nil")
	}
	if mat.AccessToken != "access-token" {
		t.Fatalf("AccessToken = %q, want access-token", mat.AccessToken)
	}
	if got, want := mat.GetExpiresAt().AsTime().UTC().Format(time.RFC3339), expiresAt.Format(time.RFC3339); got != want {
		t.Fatalf("ExpiresAt = %q, want %q", got, want)
	}
}

func TestApplyOAuthArtifactSecretData(t *testing.T) {
	t.Parallel()

	secret := &corev1.Secret{}
	applyOAuthArtifactSecretData(secret, "codex", credentialcontract.OAuthArtifact{
		TokenType:         "Bearer",
		AccountID:         "account-1",
		RefreshToken:      "refresh-token",
		IDToken:           "id-token",
		TokenResponseJSON: `{"resource_url":"https://portal.qwen.ai"}`,
		AccountEmail:      "dev@example.com",
	})
	if got, want := secret.StringData["refresh_token"], "refresh-token"; got != want {
		t.Fatalf("secret refresh_token = %q, want %q", got, want)
	}
	if got, want := secret.StringData["id_token"], "id-token"; got != want {
		t.Fatalf("secret id_token = %q, want %q", got, want)
	}
	if got, want := secret.StringData["oauth_cli_id"], "codex"; got != want {
		t.Fatalf("secret oauth_cli_id = %q, want %q", got, want)
	}
	if got, want := secret.StringData["token_type"], "Bearer"; got != want {
		t.Fatalf("secret token_type = %q, want %q", got, want)
	}
	if got, want := secret.StringData["account_id"], "account-1"; got != want {
		t.Fatalf("secret account_id = %q, want %q", got, want)
	}
	if got, want := secret.StringData["token_response_json"], `{"resource_url":"https://portal.qwen.ai"}`; got != want {
		t.Fatalf("secret token_response_json = %q, want %q", got, want)
	}
	if got, want := secret.StringData["account_email"], "dev@example.com"; got != want {
		t.Fatalf("secret account_email = %q, want %q", got, want)
	}
}

func TestOAuthCredentialImporterRejectsEmptyCliID(t *testing.T) {
	t.Parallel()

	err := credentialcontract.ValidateOAuthImportRequest(&credentialcontract.OAuthImportRequest{
		CliID:        "",
		CredentialID: "invalid",
		DisplayName:  "Invalid",
		Artifact: credentialcontract.OAuthArtifact{
			AccessToken: "access-token",
		},
	})
	if err == nil {
		t.Fatal("ValidateOAuthImportRequest() error = nil, want empty cli id")
	}
}

func TestOAuthCredentialImporterResolvesVendorFromCLISupport(t *testing.T) {
	t.Parallel()

	client := ctrlclientfake.NewClientBuilder().
		WithScheme(testutil.NewScheme()).
		Build()

	importer, err := NewOAuthCredentialImporter(client, "code-code")
	if err != nil {
		t.Fatalf("NewOAuthCredentialImporter() error = %v", err)
	}

	_, err = importer.ImportOAuthCredential(context.Background(), &credentialcontract.OAuthImportRequest{
		CliID:        "codex",
		CredentialID: "codex-main",
		DisplayName:  "Codex Main",
		Artifact: credentialcontract.OAuthArtifact{
			AccessToken:  "access-token",
			RefreshToken: "refresh-token",
			IDToken:      testOpenAIIDToken(),
		},
	})
	if err != nil {
		t.Fatalf("ImportOAuthCredential() error = %v", err)
	}

	resource := &platformv1alpha1.CredentialDefinitionResource{}
	if err := client.Get(context.Background(), types.NamespacedName{Namespace: "code-code", Name: "codex-main"}, resource); err != nil {
		t.Fatalf("get credential resource: %v", err)
	}
	if got, want := resource.Spec.Definition.GetOauthMetadata().GetCliId(), "codex"; got != want {
		t.Fatalf("cli_id = %q, want %q", got, want)
	}
	if got, want := resource.Spec.Definition.GetVendorId(), "openai"; got != want {
		t.Fatalf("vendor_id = %q, want %q", got, want)
	}
}

func TestOAuthCredentialImporterStoresGeminiProjectID(t *testing.T) {
	loadServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got, want := r.Header.Get("Authorization"), "Bearer access-token"; got != want {
			t.Fatalf("Authorization = %q, want %q", got, want)
		}
		if err := json.NewEncoder(w).Encode(map[string]any{
			"cloudaicompanionProject": map[string]any{"id": "workspacecli-489315"},
			"paidTier":                map[string]any{"name": "Google AI Pro"},
		}); err != nil {
			t.Fatalf("Encode() error = %v", err)
		}
	}))
	defer loadServer.Close()

	client := ctrlclientfake.NewClientBuilder().
		WithScheme(testutil.NewScheme()).
		Build()

	importer, err := NewOAuthCredentialImporter(client, "code-code")
	if err != nil {
		t.Fatalf("NewOAuthCredentialImporter() error = %v", err)
	}
	importer.httpClientFactory = oauthImportHTTPClientFactoryStub{
		newClient: func(context.Context) (*http.Client, error) {
			return loadServer.Client(), nil
		},
	}
	defer codeassist.SetGeminiURLsForTest(loadServer.URL, "")()

	_, err = importer.ImportOAuthCredential(context.Background(), &credentialcontract.OAuthImportRequest{
		CliID:        geminiCLIID,
		CredentialID: "gemini-main",
		DisplayName:  "Gemini Main",
		Artifact: credentialcontract.OAuthArtifact{
			AccessToken:  "access-token",
			RefreshToken: "refresh-token",
		},
	})
	if err != nil {
		t.Fatalf("ImportOAuthCredential() error = %v", err)
	}

	secret := &corev1.Secret{}
	if err := client.Get(context.Background(), types.NamespacedName{Namespace: "code-code", Name: "gemini-main"}, secret); err != nil {
		t.Fatalf("get credential secret: %v", err)
	}
	if got, want := getOptionalSecretValue(secret, projectIDSecretKey), "workspacecli-489315"; got != want {
		t.Fatalf("project_id = %q, want %q", got, want)
	}
	if got, want := getOptionalSecretValue(secret, tierNameSecretKey), "Google AI Pro"; got != want {
		t.Fatalf("tier_name = %q, want %q", got, want)
	}
}

func TestOAuthCredentialImporterPreservesExistingGeminiProjectID(t *testing.T) {
	client := ctrlclientfake.NewClientBuilder().
		WithScheme(testutil.NewScheme()).
		WithObjects(
			&corev1.Secret{
				ObjectMeta: metav1.ObjectMeta{Name: "gemini-main", Namespace: "code-code"},
				Data: map[string][]byte{
					projectIDSecretKey: []byte("workspacecli-existing"),
					tierNameSecretKey:  []byte("Google AI Pro"),
				},
			},
		).
		Build()

	importer, err := NewOAuthCredentialImporter(client, "code-code")
	if err != nil {
		t.Fatalf("NewOAuthCredentialImporter() error = %v", err)
	}
	importer.httpClientFactory = oauthImportHTTPClientFactoryStub{
		newClient: func(context.Context) (*http.Client, error) {
			return nil, context.DeadlineExceeded
		},
	}
	loadServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if err := json.NewEncoder(w).Encode(map[string]any{
			"paidTier": map[string]any{"name": "Google AI Pro"},
		}); err != nil {
			t.Fatalf("Encode() error = %v", err)
		}
	}))
	defer loadServer.Close()
	defer codeassist.SetGeminiURLsForTest(loadServer.URL, "")()

	_, err = importer.ImportOAuthCredential(context.Background(), &credentialcontract.OAuthImportRequest{
		CliID:        geminiCLIID,
		CredentialID: "gemini-main",
		DisplayName:  "Gemini Main",
		Artifact: credentialcontract.OAuthArtifact{
			AccessToken:  "access-token",
			RefreshToken: "refresh-token",
		},
	})
	if err != nil {
		t.Fatalf("ImportOAuthCredential() error = %v", err)
	}

	secret := &corev1.Secret{}
	if err := client.Get(context.Background(), types.NamespacedName{Namespace: "code-code", Name: "gemini-main"}, secret); err != nil {
		t.Fatalf("get credential secret: %v", err)
	}
	if got, want := getOptionalSecretValue(secret, projectIDSecretKey), "workspacecli-existing"; got != want {
		t.Fatalf("project_id = %q, want %q", got, want)
	}
	if got, want := getOptionalSecretValue(secret, tierNameSecretKey), "Google AI Pro"; got != want {
		t.Fatalf("tier_name = %q, want %q", got, want)
	}
}

func TestOAuthCredentialImporterStoresAntigravityProjectID(t *testing.T) {
	loadServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got, want := r.Header.Get("Authorization"), "Bearer access-token"; got != want {
			t.Fatalf("Authorization = %q, want %q", got, want)
		}
		if got, want := r.Header.Get("X-Goog-Api-Client"), codeassist.AntigravityAPIClient; got != want {
			t.Fatalf("X-Goog-Api-Client = %q, want %q", got, want)
		}
		if err := json.NewEncoder(w).Encode(map[string]any{
			"cloudaicompanionProject": map[string]any{"id": "workspacecli-123"},
			"paidTier":                map[string]any{"name": "Google AI Ultra"},
		}); err != nil {
			t.Fatalf("Encode() error = %v", err)
		}
	}))
	defer loadServer.Close()

	client := ctrlclientfake.NewClientBuilder().
		WithScheme(testutil.NewScheme()).
		Build()

	importer, err := NewOAuthCredentialImporter(client, "code-code")
	if err != nil {
		t.Fatalf("NewOAuthCredentialImporter() error = %v", err)
	}
	importer.httpClientFactory = oauthImportHTTPClientFactoryStub{
		newClient: func(context.Context) (*http.Client, error) {
			return loadServer.Client(), nil
		},
	}
	defer codeassist.SetAntigravityURLsForTest(loadServer.URL, "")()

	_, err = importer.ImportOAuthCredential(context.Background(), &credentialcontract.OAuthImportRequest{
		CliID:        antigravityCLIID,
		CredentialID: "antigravity-main",
		DisplayName:  "Antigravity Main",
		Artifact: credentialcontract.OAuthArtifact{
			AccessToken:  "access-token",
			RefreshToken: "refresh-token",
		},
	})
	if err != nil {
		t.Fatalf("ImportOAuthCredential() error = %v", err)
	}

	secret := &corev1.Secret{}
	if err := client.Get(context.Background(), types.NamespacedName{Namespace: "code-code", Name: "antigravity-main"}, secret); err != nil {
		t.Fatalf("get credential secret: %v", err)
	}
	if got, want := getOptionalSecretValue(secret, projectIDSecretKey), "workspacecli-123"; got != want {
		t.Fatalf("project_id = %q, want %q", got, want)
	}
	if got, want := getOptionalSecretValue(secret, tierNameSecretKey), "Google AI Ultra"; got != want {
		t.Fatalf("tier_name = %q, want %q", got, want)
	}
}

func TestOAuthCredentialImporterAntigravityOnboardsProjectID(t *testing.T) {
	loadServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if err := json.NewEncoder(w).Encode(map[string]any{
			"allowedTiers": []any{
				map[string]any{"id": "tier-pro", "name": "Google AI Pro", "isDefault": true},
			},
		}); err != nil {
			t.Fatalf("Encode() error = %v", err)
		}
	}))
	defer loadServer.Close()
	onboardServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if err := json.NewEncoder(w).Encode(map[string]any{
			"done": true,
			"response": map[string]any{
				"cloudaicompanionProject": map[string]any{"id": "workspacecli-onboarded"},
			},
		}); err != nil {
			t.Fatalf("Encode() error = %v", err)
		}
	}))
	defer onboardServer.Close()

	client := ctrlclientfake.NewClientBuilder().
		WithScheme(testutil.NewScheme()).
		Build()

	importer, err := NewOAuthCredentialImporter(client, "code-code")
	if err != nil {
		t.Fatalf("NewOAuthCredentialImporter() error = %v", err)
	}
	importer.httpClientFactory = oauthImportHTTPClientFactoryStub{
		newClient: func(context.Context) (*http.Client, error) {
			return loadServer.Client(), nil
		},
	}
	defer codeassist.SetAntigravityURLsForTest(loadServer.URL, onboardServer.URL)()

	_, err = importer.ImportOAuthCredential(context.Background(), &credentialcontract.OAuthImportRequest{
		CliID:        antigravityCLIID,
		CredentialID: "antigravity-main",
		DisplayName:  "Antigravity Main",
		Artifact: credentialcontract.OAuthArtifact{
			AccessToken:  "access-token",
			RefreshToken: "refresh-token",
		},
	})
	if err != nil {
		t.Fatalf("ImportOAuthCredential() error = %v", err)
	}

	secret := &corev1.Secret{}
	if err := client.Get(context.Background(), types.NamespacedName{Namespace: "code-code", Name: "antigravity-main"}, secret); err != nil {
		t.Fatalf("get credential secret: %v", err)
	}
	if got, want := getOptionalSecretValue(secret, projectIDSecretKey), "workspacecli-onboarded"; got != want {
		t.Fatalf("project_id = %q, want %q", got, want)
	}
	if got, want := getOptionalSecretValue(secret, tierNameSecretKey), "Google AI Pro"; got != want {
		t.Fatalf("tier_name = %q, want %q", got, want)
	}
}

func TestOAuthCredentialImporterRejectsAntigravityWithoutProjectID(t *testing.T) {
	loadServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if err := json.NewEncoder(w).Encode(map[string]any{
			"allowedTiers": []any{
				map[string]any{"id": "tier-pro", "isDefault": true},
			},
		}); err != nil {
			t.Fatalf("Encode() error = %v", err)
		}
	}))
	defer loadServer.Close()
	onboardServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if err := json.NewEncoder(w).Encode(map[string]any{
			"done":     true,
			"response": map[string]any{},
		}); err != nil {
			t.Fatalf("Encode() error = %v", err)
		}
	}))
	defer onboardServer.Close()

	client := ctrlclientfake.NewClientBuilder().
		WithScheme(testutil.NewScheme()).
		Build()

	importer, err := NewOAuthCredentialImporter(client, "code-code")
	if err != nil {
		t.Fatalf("NewOAuthCredentialImporter() error = %v", err)
	}
	importer.httpClientFactory = oauthImportHTTPClientFactoryStub{
		newClient: func(context.Context) (*http.Client, error) {
			return loadServer.Client(), nil
		},
	}
	defer codeassist.SetAntigravityURLsForTest(loadServer.URL, onboardServer.URL)()

	_, err = importer.ImportOAuthCredential(context.Background(), &credentialcontract.OAuthImportRequest{
		CliID:        antigravityCLIID,
		CredentialID: "antigravity-main",
		DisplayName:  "Antigravity Main",
		Artifact: credentialcontract.OAuthArtifact{
			AccessToken:  "access-token",
			RefreshToken: "refresh-token",
		},
	})
	if err == nil || !strings.Contains(err.Error(), "project id is required") {
		t.Fatalf("ImportOAuthCredential() error = %v, want project id required", err)
	}

	secret := &corev1.Secret{}
	err = client.Get(context.Background(), types.NamespacedName{Namespace: "code-code", Name: "antigravity-main"}, secret)
	if !apierrors.IsNotFound(err) {
		t.Fatalf("credential secret exists after failed import: %v", err)
	}
}

func TestOAuthCredentialImporterReportsAntigravityIneligibleTier(t *testing.T) {
	loadServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if err := json.NewEncoder(w).Encode(map[string]any{
			"allowedTiers": []any{
				map[string]any{"id": "free-tier", "isDefault": true},
			},
			"ineligibleTiers": []any{
				map[string]any{
					"reasonCode":    "UNSUPPORTED_LOCATION",
					"reasonMessage": "Your current account is not eligible for Antigravity, because it is not currently available in your location.",
				},
			},
		}); err != nil {
			t.Fatalf("Encode() error = %v", err)
		}
	}))
	defer loadServer.Close()
	onboardServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if err := json.NewEncoder(w).Encode(map[string]any{
			"done":     true,
			"response": map[string]any{},
		}); err != nil {
			t.Fatalf("Encode() error = %v", err)
		}
	}))
	defer onboardServer.Close()

	client := ctrlclientfake.NewClientBuilder().
		WithScheme(testutil.NewScheme()).
		Build()

	importer, err := NewOAuthCredentialImporter(client, "code-code")
	if err != nil {
		t.Fatalf("NewOAuthCredentialImporter() error = %v", err)
	}
	importer.httpClientFactory = oauthImportHTTPClientFactoryStub{
		newClient: func(context.Context) (*http.Client, error) {
			return loadServer.Client(), nil
		},
	}
	defer codeassist.SetAntigravityURLsForTest(loadServer.URL, onboardServer.URL)()

	_, err = importer.ImportOAuthCredential(context.Background(), &credentialcontract.OAuthImportRequest{
		CliID:        antigravityCLIID,
		CredentialID: "antigravity-main",
		DisplayName:  "Antigravity Main",
		Artifact: credentialcontract.OAuthArtifact{
			AccessToken:  "access-token",
			RefreshToken: "refresh-token",
		},
	})
	if err == nil || !strings.Contains(err.Error(), "not currently available in your location") {
		t.Fatalf("ImportOAuthCredential() error = %v, want ineligible location message", err)
	}
}

func TestOAuthCredentialImporterDoesNotOnboardAntigravityCurrentTierWithoutProject(t *testing.T) {
	loadServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if err := json.NewEncoder(w).Encode(map[string]any{
			"currentTier": map[string]any{"id": "standard-tier", "name": "Google AI Pro"},
		}); err != nil {
			t.Fatalf("Encode() error = %v", err)
		}
	}))
	defer loadServer.Close()
	onboardCalled := false
	onboardServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		onboardCalled = true
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer onboardServer.Close()

	client := ctrlclientfake.NewClientBuilder().
		WithScheme(testutil.NewScheme()).
		Build()

	importer, err := NewOAuthCredentialImporter(client, "code-code")
	if err != nil {
		t.Fatalf("NewOAuthCredentialImporter() error = %v", err)
	}
	importer.httpClientFactory = oauthImportHTTPClientFactoryStub{
		newClient: func(context.Context) (*http.Client, error) {
			return loadServer.Client(), nil
		},
	}
	defer codeassist.SetAntigravityURLsForTest(loadServer.URL, onboardServer.URL)()

	_, err = importer.ImportOAuthCredential(context.Background(), &credentialcontract.OAuthImportRequest{
		CliID:        antigravityCLIID,
		CredentialID: "antigravity-main",
		DisplayName:  "Antigravity Main",
		Artifact: credentialcontract.OAuthArtifact{
			AccessToken:  "access-token",
			RefreshToken: "refresh-token",
		},
	})
	if err == nil || !strings.Contains(err.Error(), "project id is required") {
		t.Fatalf("ImportOAuthCredential() error = %v, want project id required", err)
	}
	if onboardCalled {
		t.Fatal("onboardUser was called for currentTier without project")
	}
}

func TestOAuthCredentialImporterAntigravityUsesTierIDWhenNameIsGeneric(t *testing.T) {
	loadServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if err := json.NewEncoder(w).Encode(map[string]any{
			"cloudaicompanionProject": map[string]any{"id": "workspacecli-antigravity"},
			"currentTier": map[string]any{
				"id":   "free-tier",
				"name": "Antigravity",
			},
			"allowedTiers": []any{
				map[string]any{
					"id":        "free-tier",
					"name":      "Antigravity",
					"isDefault": true,
				},
			},
		}); err != nil {
			t.Fatalf("Encode() error = %v", err)
		}
	}))
	defer loadServer.Close()

	client := ctrlclientfake.NewClientBuilder().
		WithScheme(testutil.NewScheme()).
		Build()

	importer, err := NewOAuthCredentialImporter(client, "code-code")
	if err != nil {
		t.Fatalf("NewOAuthCredentialImporter() error = %v", err)
	}
	importer.httpClientFactory = oauthImportHTTPClientFactoryStub{
		newClient: func(context.Context) (*http.Client, error) {
			return loadServer.Client(), nil
		},
	}
	defer codeassist.SetAntigravityURLsForTest(loadServer.URL, "")()

	_, err = importer.ImportOAuthCredential(context.Background(), &credentialcontract.OAuthImportRequest{
		CliID:        antigravityCLIID,
		CredentialID: "antigravity-main",
		DisplayName:  "Antigravity Main",
		Artifact: credentialcontract.OAuthArtifact{
			AccessToken:  "access-token",
			RefreshToken: "refresh-token",
		},
	})
	if err != nil {
		t.Fatalf("ImportOAuthCredential() error = %v", err)
	}

	secret := &corev1.Secret{}
	if err := client.Get(context.Background(), types.NamespacedName{Namespace: "code-code", Name: "antigravity-main"}, secret); err != nil {
		t.Fatalf("get credential secret: %v", err)
	}
	if got, want := getOptionalSecretValue(secret, tierNameSecretKey), "Free"; got != want {
		t.Fatalf("tier_name = %q, want %q", got, want)
	}
}

type oauthImportHTTPClientFactoryStub struct {
	newClient func(context.Context) (*http.Client, error)
}

func (s oauthImportHTTPClientFactoryStub) NewClient(ctx context.Context) (*http.Client, error) {
	return s.newClient(ctx)
}
