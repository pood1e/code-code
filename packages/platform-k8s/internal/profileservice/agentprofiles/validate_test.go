package agentprofiles

import (
	"context"
	"strings"
	"testing"

	apiprotocolv1 "code-code.internal/go-contract/api_protocol/v1"
	agentprofilev1 "code-code.internal/go-contract/platform/agent_profile/v1"
	supportv1 "code-code.internal/go-contract/platform/support/v1"
	providerv1 "code-code.internal/go-contract/provider/v1"
)

func TestNormalizeSelectionStrategyAcceptsKnownExecutionClass(t *testing.T) {
	t.Parallel()

	service := newTestService(t,
		newTestCLIReference("codex"),
		newTestProvider("provider-account-1", "openai-default"),
	)

	selection, err := service.normalizeSelectionStrategy(context.Background(), &agentprofilev1.AgentSelectionStrategy{
		ProviderId:     "codex",
		ExecutionClass: "default",
		Fallbacks: []*agentprofilev1.AgentFallbackCandidate{{
			ProviderRuntimeRef: &providerv1.ProviderRuntimeRef{SurfaceId: "openai-default"},
			ModelSelector:      &agentprofilev1.AgentFallbackCandidate_ProviderModelId{ProviderModelId: "gpt-5"},
		}},
	})
	if err != nil {
		t.Fatalf("normalizeSelectionStrategy() error = %v", err)
	}
	if got := selection.GetExecutionClass(); got != "default" {
		t.Fatalf("execution_class = %q, want default", got)
	}
}

func TestNormalizeSelectionStrategyRejectsUnknownExecutionClass(t *testing.T) {
	t.Parallel()

	service := newTestService(t, newTestCLIReference("codex"))

	_, err := service.normalizeSelectionStrategy(context.Background(), &agentprofilev1.AgentSelectionStrategy{
		ProviderId:     "codex",
		ExecutionClass: "gpu",
	})
	if err == nil {
		t.Fatal("normalizeSelectionStrategy() error = nil, want validation error")
	}
	if !strings.Contains(err.Error(), `execution class "gpu" is not declared`) {
		t.Fatalf("error = %v, want unknown execution class", err)
	}
}

func newTestService(t *testing.T, objects ...any) *Service {
	t.Helper()

	providerReferences := newProviderReferencesFromObjects(objects)
	service, err := NewService(Config{
		Store:              newMemoryProfileStore(),
		ProviderReferences: providerReferences,
		ResourceReferences: newResourceReferencesFromObjects(objects),
	})
	if err != nil {
		t.Fatalf("NewService() error = %v", err)
	}
	return service
}

type testCLISupport struct {
	cliID        string
	capabilities []*supportv1.RuntimeCapability
}

func newTestCLISupport(cliID string, capabilities []*supportv1.RuntimeCapability) testCLISupport {
	return testCLISupport{cliID: cliID, capabilities: capabilities}
}

func newTestProviderSurfaceBinding(surfaceID string) *providerv1.Provider {
	return newTestProvider("provider-"+surfaceID, surfaceID)
}

func newTestProvider(providerID, surfaceID string) *providerv1.Provider {
	return &providerv1.Provider{
		ProviderId:  providerID,
		DisplayName: "OpenAI Provider",
		Surfaces: []*providerv1.ProviderSurfaceBinding{{
			SurfaceId: surfaceID,
			SourceRef: &providerv1.ProviderSurfaceSourceRef{
				Kind:      providerv1.ProviderSurfaceSourceKind_PROVIDER_SURFACE_SOURCE_KIND_VENDOR,
				Id:        "openai",
				SurfaceId: "openai-compatible",
			},
			Runtime: &providerv1.ProviderSurfaceRuntime{
				DisplayName: surfaceID,
				Origin:      providerv1.ProviderSurfaceOrigin_PROVIDER_SURFACE_ORIGIN_MANUAL,
				Access: &providerv1.ProviderSurfaceRuntime_Api{
					Api: &providerv1.ProviderAPISurfaceRuntime{
						Protocol: apiprotocolv1.Protocol_PROTOCOL_OPENAI_RESPONSES,
						BaseUrl:  "https://api.openai.com/v1",
					},
				},
			},
		}},
	}
}

func newSelectionStrategy() *agentprofilev1.AgentSelectionStrategy {
	return &agentprofilev1.AgentSelectionStrategy{
		ProviderId:     "codex",
		ExecutionClass: "default",
		Fallbacks: []*agentprofilev1.AgentFallbackCandidate{{
			ProviderRuntimeRef: &providerv1.ProviderRuntimeRef{SurfaceId: "openai-default"},
			ModelSelector:      &agentprofilev1.AgentFallbackCandidate_ProviderModelId{ProviderModelId: "gpt-5"},
		}},
	}
}
