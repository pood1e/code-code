package providerobservability

import (
	"net/http"
	"net/textproto"
	"sort"
	"strings"

	credentialv1 "code-code.internal/go-contract/credential/v1"
	"code-code.internal/platform-k8s/egressauth"
)

type observabilityEgressAuth struct {
	SecretNamespace    string
	SecretName         string
	CredentialID       string
	CLIID              string
	VendorID           string
	ProviderID         string
	ProviderSurfaceBindingID string
	RequestHeaderName  string
	HeaderValuePrefix  string
	AuthAdapterID      string
}

func withObservabilityEgressAuth(client *http.Client, auth observabilityEgressAuth) *http.Client {
	if client == nil {
		client = http.DefaultClient
	}
	if strings.TrimSpace(auth.SecretName) == "" && strings.TrimSpace(auth.CredentialID) == "" {
		return client
	}
	next := *client
	base := client.Transport
	if base == nil {
		base = http.DefaultTransport
	}
	next.Transport = observabilityEgressAuthRoundTripper{
		base: base,
		auth: auth,
	}
	return &next
}

type observabilityEgressAuthRoundTripper struct {
	base http.RoundTripper
	auth observabilityEgressAuth
}

func (t observabilityEgressAuthRoundTripper) RoundTrip(request *http.Request) (*http.Response, error) {
	next := request.Clone(request.Context())
	next.Header = request.Header.Clone()
	headerNames := placeholderRequestHeaderNames(next.Header)
	if len(headerNames) == 0 {
		headerName := strings.ToLower(strings.TrimSpace(t.auth.RequestHeaderName))
		if headerName == "" {
			headerName = "authorization"
		}
		next.Header.Set(textproto.CanonicalMIMEHeaderKey(headerName), placeholderHeaderValue(t.auth.HeaderValuePrefix))
		headerNames = []string{headerName}
	}
	if namespace := strings.TrimSpace(t.auth.SecretNamespace); namespace != "" {
		next.Header.Set(egressauth.HeaderCredentialSecretNamespace, namespace)
	}
	setOptionalHeader(next.Header, egressauth.HeaderCredentialID, t.auth.CredentialID)
	setOptionalHeader(next.Header, egressauth.HeaderCredentialSecretName, t.auth.SecretName)
	if host := strings.TrimSpace(next.URL.Host); host != "" {
		next.Header.Set(egressauth.HeaderTargetHosts, host)
	}
	next.Header.Set(egressauth.HeaderRequestHeaderNames, strings.Join(headerNames, ","))
	if prefix := strings.TrimSpace(t.auth.HeaderValuePrefix); prefix != "" {
		next.Header.Set(egressauth.HeaderHeaderValuePrefix, prefix)
	}
	setOptionalHeader(next.Header, egressauth.HeaderAuthAdapterID, t.auth.AuthAdapterID)
	setOptionalHeader(next.Header, egressauth.HeaderCLIID, t.auth.CLIID)
	setOptionalHeader(next.Header, egressauth.HeaderVendorID, t.auth.VendorID)
	setOptionalHeader(next.Header, egressauth.HeaderProviderID, t.auth.ProviderID)
	setOptionalHeader(next.Header, egressauth.HeaderProviderSurfaceBindingID, t.auth.ProviderSurfaceBindingID)
	return t.base.RoundTrip(next)
}

func placeholderRequestHeaderNames(headers http.Header) []string {
	if len(headers) == 0 {
		return nil
	}
	names := make([]string, 0)
	seen := map[string]struct{}{}
	for name, values := range headers {
		normalized := strings.ToLower(strings.TrimSpace(name))
		if normalized == "" {
			continue
		}
		for _, value := range values {
			if !strings.Contains(value, egressauth.Placeholder) {
				continue
			}
			if _, ok := seen[normalized]; ok {
				break
			}
			seen[normalized] = struct{}{}
			names = append(names, normalized)
			break
		}
	}
	sort.Strings(names)
	return names
}

func setOptionalHeader(headers http.Header, name string, value string) {
	if value = strings.TrimSpace(value); value != "" {
		headers.Set(name, value)
	}
}

func placeholderHeaderValue(prefix string) string {
	prefix = strings.TrimSpace(prefix)
	if prefix == "" {
		return egressauth.Placeholder
	}
	return prefix + " " + egressauth.Placeholder
}

func fakeOAuthCredential(credentialID string) *credentialv1.ResolvedCredential {
	return &credentialv1.ResolvedCredential{
		CredentialId: strings.TrimSpace(credentialID),
		Kind:         credentialv1.CredentialKind_CREDENTIAL_KIND_OAUTH,
		Material: &credentialv1.ResolvedCredential_Oauth{
			Oauth: &credentialv1.OAuthCredential{
				AccessToken: egressauth.Placeholder,
				TokenType:   "Bearer",
			},
		},
	}
}

func fakeSessionCredential(credentialID string) *credentialv1.ResolvedCredential {
	return &credentialv1.ResolvedCredential{
		CredentialId: strings.TrimSpace(credentialID),
		Kind:         credentialv1.CredentialKind_CREDENTIAL_KIND_SESSION,
		Material: &credentialv1.ResolvedCredential_Session{
			Session: &credentialv1.SessionCredential{
				Values: map[string]string{
					"access_token":         egressauth.Placeholder,
					"api_key":              egressauth.Placeholder,
					"authjs.session-token": egressauth.Placeholder,
					"authjs_session_token": egressauth.Placeholder,
					"authorization":        egressauth.Placeholder,
					"cookie":               egressauth.Placeholder,
					"page_api_key":         egressauth.Placeholder,
					"session_token":        egressauth.Placeholder,
					"token":                egressauth.Placeholder,
				},
			},
		},
	}
}
