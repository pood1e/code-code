package modelservice

import (
	"testing"

	apiprotocolv1 "code-code.internal/go-contract/api_protocol/v1"
	credentialv1 "code-code.internal/go-contract/credential/v1"
	modelcatalogdiscoveryv1 "code-code.internal/go-contract/model_catalog_discovery/v1"
	"code-code.internal/platform-k8s/modelcatalogsources"
)

func TestCatalogProbeLeaseKeyUsesSourceConcurrencyKey(t *testing.T) {
	operation := &modelcatalogdiscoveryv1.ModelCatalogDiscoveryOperation{
		Path:         "models",
		ResponseKind: modelcatalogdiscoveryv1.ModelCatalogDiscoveryResponseKind_MODEL_CATALOG_DISCOVERY_RESPONSE_KIND_OPENAI_MODELS,
	}
	requestA := modelcatalogsources.ProbeRequest{
		Protocol:       apiprotocolv1.Protocol_PROTOCOL_OPENAI_COMPATIBLE,
		BaseURL:        "https://api.example.test/v1",
		AuthRef:        &credentialv1.CredentialRef{CredentialId: "credential-a"},
		ConcurrencyKey: "probe.example",
	}
	requestB := requestA
	requestB.AuthRef = &credentialv1.CredentialRef{CredentialId: "credential-b"}

	keyA := catalogProbeSingleflightKey(requestA, operation)
	keyB := catalogProbeSingleflightKey(requestB, operation)
	if keyA == keyB {
		t.Fatalf("singleflight keys should remain request-specific")
	}
	if got, want := catalogProbeLeaseKey(requestA, keyA), "probe.example"; got != want {
		t.Fatalf("lease key = %q, want %q", got, want)
	}
	if got, want := catalogProbeLeaseKey(modelcatalogsources.ProbeRequest{}, keyA), keyA; got != want {
		t.Fatalf("fallback lease key = %q, want %q", got, want)
	}
}
