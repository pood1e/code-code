package authservice

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	credentialv1 "code-code.internal/go-contract/credential/v1"
	authv1 "code-code.internal/go-contract/platform/auth/v1"
	managementv1 "code-code.internal/go-contract/platform/management/v1"
	"code-code.internal/platform-k8s/egressauth"
	"google.golang.org/grpc"
)

type fakeCredentialResolver struct {
	credential *credentialv1.ResolvedCredential
	err        error
	grantID    string
}

func (r *fakeCredentialResolver) Resolve(_ context.Context, ref *credentialv1.CredentialGrantRef) (*credentialv1.ResolvedCredential, error) {
	if ref != nil {
		r.grantID = ref.GetGrantId()
	}
	return r.credential, r.err
}

type fakeRuntimeContextClient struct {
	request  *managementv1.ResolveAgentRunRuntimeContextRequest
	response *managementv1.ResolveAgentRunRuntimeContextResponse
	err      error
}

func (c *fakeRuntimeContextClient) ResolveAgentRunRuntimeContext(_ context.Context, request *managementv1.ResolveAgentRunRuntimeContextRequest, _ ...grpc.CallOption) (*managementv1.ResolveAgentRunRuntimeContextResponse, error) {
	c.request = request
	return c.response, c.err
}

func TestEgressAuthHTTPHandlerReplacesBearerHeader(t *testing.T) {
	server := &Server{
		credentialResolver: &fakeCredentialResolver{
			credential: &credentialv1.ResolvedCredential{
				GrantId: "cred-1",
				Kind:    credentialv1.CredentialKind_CREDENTIAL_KIND_OAUTH,
				Material: &credentialv1.ResolvedCredential_Oauth{
					Oauth: &credentialv1.OAuthCredential{AccessToken: "synthetic-token", TokenType: "Bearer"},
				},
			},
		},
	}
	body := []byte(`{
		"credentialId":"cred-1",
		"headerValuePrefix":"Bearer",
		"simpleReplacementRules":[{"mode":"bearer","headerName":"authorization"}],
		"headers":[{"name":"authorization","currentValue":"Bearer PLACEHOLDER"}]
	}`)
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, egressAuthHeaderReplacementPath, bytes.NewReader(body))
	server.EgressAuthHTTPHandler().ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", recorder.Code, recorder.Body.String())
	}
	var response egressAuthHeaderReplacementResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if response.Headers["authorization"] != "Bearer synthetic-token" {
		t.Fatalf("authorization = %q", response.Headers["authorization"])
	}
	if len(response.RemoveHeaders) == 0 {
		t.Fatal("RemoveHeaders is empty")
	}
}

func TestResolveEgressRequestHeadersResolvesCredentialFromRuntimeSource(t *testing.T) {
	runtimeContext := &fakeRuntimeContextClient{
		response: &managementv1.ResolveAgentRunRuntimeContextResponse{
			Metadata: &managementv1.AgentRunRuntimeMetadata{
				CredentialId:       "cred-1",
				TargetHosts:        []string{"api.example.test"},
				TargetPathPrefixes: []string{"/v1"},
				RequestHeaderNames: []string{"authorization"},
				HeaderValuePrefix:  "Bearer",
			},
		},
	}
	server := &Server{
		agentSessions: runtimeContext,
		credentialResolver: &fakeCredentialResolver{
			credential: &credentialv1.ResolvedCredential{
				GrantId: "cred-1",
				Kind:    credentialv1.CredentialKind_CREDENTIAL_KIND_SESSION,
				Material: &credentialv1.ResolvedCredential_Session{
					Session: &credentialv1.SessionCredential{Values: map[string]string{
						"authorization": "synthetic-token",
					}},
				},
			},
		},
	}

	response, err := server.ResolveEgressRequestHeaders(context.Background(), &authv1.ResolveEgressRequestHeadersRequest{
		CredentialId: "forged-credential",
		RuntimeSource: &authv1.EgressRequestSource{Source: &authv1.EgressRequestSource_Pod{Pod: &authv1.EgressPodSource{
			Namespace: "code-code-runs",
			Ip:        "10.0.0.12",
		}}},
		TargetHost: "api.example.test:443",
		TargetPath: "/v1/chat/completions",
	})
	if err != nil {
		t.Fatalf("ResolveEgressRequestHeaders() error = %v", err)
	}
	if got, want := runtimeContext.request.GetPod().GetIp(), "10.0.0.12"; got != want {
		t.Fatalf("runtime source pod.ip = %q, want %q", got, want)
	}
	if response.GetHeaders()["authorization"] != "Bearer synthetic-token" {
		t.Fatalf("authorization = %q", response.GetHeaders()["authorization"])
	}
	if got, want := server.credentialResolver.(*fakeCredentialResolver).grantID, "cred-1"; got != want {
		t.Fatalf("resolved credential id = %q, want %q", got, want)
	}
}

func TestResolveEgressRequestHeadersSkipsRuntimeSourceTargetMismatch(t *testing.T) {
	runtimeContext := &fakeRuntimeContextClient{
		response: &managementv1.ResolveAgentRunRuntimeContextResponse{
			Metadata: &managementv1.AgentRunRuntimeMetadata{
				CredentialId:       "cred-1",
				TargetHosts:        []string{"api.example.test"},
				TargetPathPrefixes: []string{"/v1"},
				RequestHeaderNames: []string{"authorization"},
			},
		},
	}
	server := &Server{agentSessions: runtimeContext}

	response, err := server.ResolveEgressRequestHeaders(context.Background(), &authv1.ResolveEgressRequestHeadersRequest{
		RuntimeSource: &authv1.EgressRequestSource{Source: &authv1.EgressRequestSource_Pod{Pod: &authv1.EgressPodSource{
			Ip: "10.0.0.12",
		}}},
		TargetHost: "other.example.test",
		TargetPath: "/v1/chat/completions",
		Headers: []*authv1.EgressHeaderReplacementItem{{
			Name:         "authorization",
			CurrentValue: "Bearer PLACEHOLDER",
		}},
	})
	if err != nil {
		t.Fatalf("ResolveEgressRequestHeaders() error = %v", err)
	}
	if !response.GetSkipped() {
		t.Fatalf("skipped = false, response = %#v", response)
	}
	if containsHeaderName(response.GetRemoveHeaders(), "authorization") {
		t.Fatalf("remove_headers = %v", response.GetRemoveHeaders())
	}
}

func TestResolveEgressRequestHeadersSkipsRuntimeSourceWithoutAuthMetadata(t *testing.T) {
	runtimeContext := &fakeRuntimeContextClient{
		response: &managementv1.ResolveAgentRunRuntimeContextResponse{
			Metadata: &managementv1.AgentRunRuntimeMetadata{},
		},
	}
	server := &Server{agentSessions: runtimeContext}

	response, err := server.ResolveEgressRequestHeaders(context.Background(), &authv1.ResolveEgressRequestHeadersRequest{
		RuntimeSource: &authv1.EgressRequestSource{Source: &authv1.EgressRequestSource_Pod{Pod: &authv1.EgressPodSource{
			Ip: "10.0.0.12",
		}}},
		TargetHost: "api.example.test",
		TargetPath: "/v1/chat/completions",
	})
	if err != nil {
		t.Fatalf("ResolveEgressRequestHeaders() error = %v", err)
	}
	if !response.GetSkipped() {
		t.Fatalf("skipped = false, response = %#v", response)
	}
}

func TestResolveEgressResponseHeadersSanitizesRuntimeSource(t *testing.T) {
	runtimeContext := &fakeRuntimeContextClient{
		response: &managementv1.ResolveAgentRunRuntimeContextResponse{
			Metadata: &managementv1.AgentRunRuntimeMetadata{
				CredentialId:       "cred-1",
				TargetHosts:        []string{"accounts.example.test"},
				TargetPathPrefixes: []string{"/oauth"},
				ResponseHeaderReplacementRules: []*managementv1.AgentRunRuntimeHeaderReplacementRule{{
					HeaderName:  "set-cookie",
					MaterialKey: "session_id",
					Template:    "SID=PLACEHOLDER",
				}},
			},
		},
	}
	server := &Server{
		agentSessions: runtimeContext,
		credentialResolver: &fakeCredentialResolver{
			credential: &credentialv1.ResolvedCredential{
				GrantId: "cred-1",
				Kind:    credentialv1.CredentialKind_CREDENTIAL_KIND_SESSION,
				Material: &credentialv1.ResolvedCredential_Session{
					Session: &credentialv1.SessionCredential{Values: map[string]string{
						"session_id": "session-secret",
					}},
				},
			},
		},
	}

	response, err := server.ResolveEgressResponseHeaders(context.Background(), &authv1.ResolveEgressResponseHeadersRequest{
		RuntimeSource: &authv1.EgressRequestSource{Source: &authv1.EgressRequestSource_Pod{Pod: &authv1.EgressPodSource{
			Ip: "10.0.0.12",
		}}},
		TargetHost: "accounts.example.test",
		TargetPath: "/oauth/callback",
		Headers: []*authv1.EgressHeaderReplacementItem{{
			Name:         "set-cookie",
			CurrentValue: "SID=session-secret; Path=/; Secure",
		}},
	})
	if err != nil {
		t.Fatalf("ResolveEgressResponseHeaders() error = %v", err)
	}
	if got, want := response.GetHeaders()["set-cookie"], "SID=PLACEHOLDER; Path=/; Secure"; got != want {
		t.Fatalf("set-cookie = %q, want %q", got, want)
	}
}

func TestResolveEgressResponseHeadersSanitizesControlPlaneTemplate(t *testing.T) {
	server := &Server{
		credentialResolver: &fakeCredentialResolver{
			credential: &credentialv1.ResolvedCredential{
				GrantId: "cred-1",
				Kind:    credentialv1.CredentialKind_CREDENTIAL_KIND_OAUTH,
				Material: &credentialv1.ResolvedCredential_Oauth{
					Oauth: &credentialv1.OAuthCredential{AccessToken: "response-token"},
				},
			},
		},
	}

	response, err := server.ResolveEgressResponseHeaders(context.Background(), &authv1.ResolveEgressResponseHeadersRequest{
		CredentialId: "cred-1",
		SimpleReplacementRules: []*authv1.EgressSimpleReplacementRule{{
			HeaderName:  "authorization",
			MaterialKey: "access_token",
			Template:    "Bearer PLACEHOLDER",
		}},
		AllowedHeaderNames: []string{"authorization"},
		Headers: []*authv1.EgressHeaderReplacementItem{{
			Name:         "authorization",
			CurrentValue: "Bearer response-token",
		}},
	})
	if err != nil {
		t.Fatalf("ResolveEgressResponseHeaders() error = %v", err)
	}
	if got, want := response.GetHeaders()["authorization"], "Bearer PLACEHOLDER"; got != want {
		t.Fatalf("authorization = %q, want %q", got, want)
	}
}

func TestEgressAuthHTTPHandlerGoogleAIStudioAdapter(t *testing.T) {
	server := &Server{
		credentialResolver: &fakeCredentialResolver{
			credential: &credentialv1.ResolvedCredential{
				GrantId: "cred-1",
				Kind:    credentialv1.CredentialKind_CREDENTIAL_KIND_SESSION,
				Material: &credentialv1.ResolvedCredential_Session{
					Session: &credentialv1.SessionCredential{Values: map[string]string{
						"page_api_key": "page-key",
						"cookie":       "SAPISID=sapisid",
					}},
				},
			},
		},
	}
	body := []byte(`{
		"credentialId":"cred-1",
		"adapterId":"google-aistudio-session",
		"headers":[{"name":"x-goog-api-key","currentValue":"PLACEHOLDER"}]
	}`)
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, egressAuthHeaderReplacementPath, bytes.NewReader(body))
	server.EgressAuthHTTPHandler().ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", recorder.Code, recorder.Body.String())
	}
	var response egressAuthHeaderReplacementResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if response.Headers["x-goog-api-key"] != "page-key" {
		t.Fatalf("x-goog-api-key = %q", response.Headers["x-goog-api-key"])
	}
}

func TestEgressAuthHTTPHandlerUsesDeclarativeSimpleRule(t *testing.T) {
	server := &Server{
		credentialResolver: &fakeCredentialResolver{
			credential: &credentialv1.ResolvedCredential{
				GrantId: "cred-1",
				Kind:    credentialv1.CredentialKind_CREDENTIAL_KIND_OAUTH,
				Material: &credentialv1.ResolvedCredential_Oauth{
					Oauth: &credentialv1.OAuthCredential{
						AccessToken: "access-token",
						IdToken:     "id-token",
					},
				},
			},
		},
	}
	body := []byte(`{
		"credentialId":"cred-1",
		"simpleReplacementRules":[{"headerName":"authorization","materialKey":"id_token","template":"Bearer PLACEHOLDER"}],
		"headers":[{"name":"authorization","currentValue":"PLACEHOLDER"}]
	}`)
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, egressAuthHeaderReplacementPath, bytes.NewReader(body))
	server.EgressAuthHTTPHandler().ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", recorder.Code, recorder.Body.String())
	}
	var response egressAuthHeaderReplacementResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if response.Headers["authorization"] != "Bearer id-token" {
		t.Fatalf("authorization = %q", response.Headers["authorization"])
	}
}

func TestEgressAuthHTTPHandlerDoesNotEchoMaterialOnFailure(t *testing.T) {
	server := &Server{
		credentialResolver: &fakeCredentialResolver{
			credential: &credentialv1.ResolvedCredential{
				GrantId:  "cred-1",
				Kind:     credentialv1.CredentialKind_CREDENTIAL_KIND_API_KEY,
				Material: &credentialv1.ResolvedCredential_ApiKey{ApiKey: &credentialv1.ApiKeyCredential{ApiKey: "synthetic-secret"}},
			},
		},
	}
	body := []byte(`{
		"credentialId":"cred-1",
		"headers":[{"name":"authorization","currentValue":"no-placeholder"}]
	}`)
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, egressAuthHeaderReplacementPath, bytes.NewReader(body))
	server.EgressAuthHTTPHandler().ServeHTTP(recorder, request)

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, body = %s", recorder.Code, recorder.Body.String())
	}
	if bytes.Contains(recorder.Body.Bytes(), []byte("synthetic-secret")) || bytes.Contains(recorder.Body.Bytes(), []byte(egressauth.Placeholder)) {
		t.Fatalf("failure response leaked sensitive material: %s", recorder.Body.String())
	}
}

func containsHeaderName(values []string, want string) bool {
	for _, value := range values {
		if value == want {
			return true
		}
	}
	return false
}
