package providerobservability

import (
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"code-code.internal/platform-k8s/egressauth"
)

func TestWithObservabilityEgressAuthUsesCredentialIDOnly(t *testing.T) {
	t.Parallel()

	var requestHeaders http.Header
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestHeaders = r.Header.Clone()
		_, _ = io.WriteString(w, "ok")
	}))
	defer server.Close()

	client := withObservabilityEgressAuth(server.Client(), observabilityEgressAuth{
		SecretNamespace:   "code-code",
		CredentialID:      "grant-1",
		RequestHeaderName: "authorization",
		HeaderValuePrefix: "Bearer",
		AuthAdapterID:     egressauth.AuthAdapterDefaultID,
	})
	request, err := http.NewRequest(http.MethodGet, server.URL+"/metrics", nil)
	if err != nil {
		t.Fatalf("NewRequest() error = %v", err)
	}
	response, err := client.Do(request)
	if err != nil {
		t.Fatalf("Do() error = %v", err)
	}
	_ = response.Body.Close()

	if got, want := requestHeaders.Get("Authorization"), "Bearer "+egressauth.Placeholder; got != want {
		t.Fatalf("authorization = %q, want %q", got, want)
	}
	if got, want := requestHeaders.Get(egressauth.HeaderCredentialID), "grant-1"; got != want {
		t.Fatalf("%s = %q, want %q", egressauth.HeaderCredentialID, got, want)
	}
	if got := requestHeaders.Get(egressauth.HeaderCredentialSecretName); got != "" {
		t.Fatalf("%s = %q, want empty", egressauth.HeaderCredentialSecretName, got)
	}
}
