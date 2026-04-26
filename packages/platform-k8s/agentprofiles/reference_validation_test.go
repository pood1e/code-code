package agentprofiles

import (
	"context"
	"strings"
	"testing"

	agentprofilev1 "code-code.internal/go-contract/platform/agent_profile/v1"
	mcpv1 "code-code.internal/go-contract/platform/mcp/v1"
	supportv1 "code-code.internal/go-contract/platform/support/v1"
)

func TestNormalizeProfileRejectsUnsupportedMCPReferences(t *testing.T) {
	t.Parallel()

	service := newTestService(t,
		newTestCLIReference("codex"),
		newTestCLISupport("codex", []*supportv1.RuntimeCapability{{
			Kind:      supportv1.RuntimeCapabilityKind_RUNTIME_CAPABILITY_KIND_MCP,
			Supported: false,
		}}),
		newTestProviderSurfaceBinding("openai-default"),
		newTestMCPServer("filesystem"),
	)

	_, err := service.normalizeProfile(context.Background(), &agentprofilev1.AgentProfile{
		Name:              "General Operator",
		SelectionStrategy: newSelectionStrategy(),
		McpIds:            []string{"filesystem"},
	})
	if err == nil {
		t.Fatal("normalizeProfile() error = nil, want unsupported mcp error")
	}
	if !strings.Contains(err.Error(), `does not support mcp resources`) {
		t.Fatalf("error = %v, want unsupported mcp", err)
	}
}

func TestNormalizeProfileAcceptsSupportedMCPReferences(t *testing.T) {
	t.Parallel()

	service := newTestService(t,
		newTestCLIReference("codex"),
		newTestCLISupport("codex", []*supportv1.RuntimeCapability{{
			Kind:          supportv1.RuntimeCapabilityKind_RUNTIME_CAPABILITY_KIND_MCP,
			Supported:     true,
			CapabilityKey: "codex.mcp",
		}}),
		newTestProviderSurfaceBinding("openai-default"),
		newTestMCPServer("filesystem"),
	)

	profile, err := service.normalizeProfile(context.Background(), &agentprofilev1.AgentProfile{
		Name:              "General Operator",
		SelectionStrategy: newSelectionStrategy(),
		McpIds:            []string{"filesystem"},
	})
	if err != nil {
		t.Fatalf("normalizeProfile() error = %v", err)
	}
	if got, want := profile.GetMcpIds(), []string{"filesystem"}; len(got) != len(want) || got[0] != want[0] {
		t.Fatalf("mcp_ids = %#v, want %#v", got, want)
	}
}

func TestNormalizeProfileRejectsReferencesWithoutCLISupport(t *testing.T) {
	t.Parallel()

	service := newTestService(t,
		newTestCLIReference("codex"),
		newTestProviderSurfaceBinding("openai-default"),
		newTestMCPServer("filesystem"),
	)

	_, err := service.normalizeProfile(context.Background(), &agentprofilev1.AgentProfile{
		Name:              "General Operator",
		SelectionStrategy: newSelectionStrategy(),
		McpIds:            []string{"filesystem"},
	})
	if err == nil {
		t.Fatal("normalizeProfile() error = nil, want missing cli support error")
	}
	if !strings.Contains(err.Error(), `does not support mcp resources`) {
		t.Fatalf("error = %v, want missing cli support", err)
	}
}

func newTestMCPServer(mcpID string) *mcpv1.MCPServer {
	return &mcpv1.MCPServer{McpId: mcpID, Name: "Filesystem"}
}
