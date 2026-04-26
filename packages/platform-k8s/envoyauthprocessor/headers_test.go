package envoyauthprocessor

import (
	"testing"

	corev3 "github.com/envoyproxy/go-control-plane/envoy/config/core/v3"
)

func TestBuildHeaderMutationUsesRawHeaderValues(t *testing.T) {
	headers := newRequestHeaders([]*corev3.HeaderValue{
		{Key: ":authority", RawValue: []byte("api.example.com")},
		{Key: "Authorization", RawValue: []byte("Bearer " + Placeholder)},
	})
	auth := &authContext{
		authBinding: authBinding{
			TargetHosts:        []string{"api.example.com"},
			RequestHeaderNames: []string{"Authorization"},
			HeaderValuePrefix:  "Bearer",
		},
		Adapter:  defaultAuthAdapter{},
		Material: map[string]string{"api_key": "secret-token"},
	}

	mutation := buildHeaderMutation(headers, auth)

	if len(mutation.SetHeaders) != 1 {
		t.Fatalf("set header count = %d, want 1", len(mutation.SetHeaders))
	}
	header := mutation.SetHeaders[0].Header
	if header.Key != "authorization" {
		t.Fatalf("set header key = %q, want authorization", header.Key)
	}
	if string(header.RawValue) != "Bearer secret-token" {
		t.Fatalf("set header raw value = %q, want Bearer secret-token", string(header.RawValue))
	}
	if header.Value != "" {
		t.Fatalf("set header value = %q, want empty raw-value mutation", header.Value)
	}
}

func TestNewRequestHeadersPrefersValueOverRawValue(t *testing.T) {
	headers := newRequestHeaders([]*corev3.HeaderValue{
		{Key: "X-Test", Value: "value", RawValue: []byte("raw")},
	})

	if got := headers.get("x-test"); got != "value" {
		t.Fatalf("header value = %q, want value", got)
	}
}
