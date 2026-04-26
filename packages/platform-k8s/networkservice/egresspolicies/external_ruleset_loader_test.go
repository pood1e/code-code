package egresspolicies

import (
	"encoding/base64"
	"net/http"
	"strings"
	"testing"
)

func TestParseAutoProxyHostsSupportsZeroOmegaRules(t *testing.T) {
	payload := []byte(`
! comment
[AutoProxy 0.2.9]
||google.com^
|https://api.openai.com/v1
@@||allowed.example.com^
/regexp/
plain.example.com
*.wildcard.example.com
`)

	hosts, skipped, err := parseAutoProxyHosts(payload)
	if err != nil {
		t.Fatalf("parseAutoProxyHosts() error = %v", err)
	}
	want := []string{"api.openai.com", "google.com", "plain.example.com"}
	if len(hosts) != len(want) {
		t.Fatalf("hosts = %v, want %v", hosts, want)
	}
	for i := range want {
		if hosts[i] != want[i] {
			t.Fatalf("hosts = %v, want %v", hosts, want)
		}
	}
	if skipped == 0 {
		t.Fatal("skipped = 0, want unsupported lines counted")
	}
}

func TestParseAutoProxyHostsDecodesBase64GFWList(t *testing.T) {
	raw := "||github.com^\n||raw.githubusercontent.com^\n"
	payload := []byte(base64.StdEncoding.EncodeToString([]byte(raw)))

	hosts, _, err := parseAutoProxyHosts(payload)
	if err != nil {
		t.Fatalf("parseAutoProxyHosts() error = %v", err)
	}
	want := []string{"github.com", "raw.githubusercontent.com"}
	if len(hosts) != len(want) {
		t.Fatalf("hosts = %v, want %v", hosts, want)
	}
	for i := range want {
		if hosts[i] != want[i] {
			t.Fatalf("hosts = %v, want %v", hosts, want)
		}
	}
}

func TestExternalRuleSetLoaderRejectsNonHTTPFetchProxy(t *testing.T) {
	loader := &httpExternalRuleSetLoader{client: &http.Client{}}
	_, err := loader.clientForProxy("socks5://127.0.0.1:7890")
	if err == nil || !strings.Contains(err.Error(), "HTTP proxy URL") {
		t.Fatalf("expected HTTP proxy URL validation error, got %v", err)
	}
}
