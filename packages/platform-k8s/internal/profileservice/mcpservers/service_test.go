package mcpservers

import (
	"context"
	"testing"

	"code-code.internal/go-contract/domainerror"
	mcpv1 "code-code.internal/go-contract/platform/mcp/v1"
)

func TestServiceListReturnsStoredMCPServers(t *testing.T) {
	t.Parallel()

	store := newMemoryMCPStore(t,
		&mcpv1.MCPServer{
			McpId: "z-mcp",
			Name:  "Z MCP",
			Transport: &mcpv1.MCPServer_StreamableHttp{
				StreamableHttp: &mcpv1.MCPServerStreamableHTTPTransport{EndpointUrl: "https://example.com/mcp"},
			},
		},
		&mcpv1.MCPServer{
			McpId: "a-mcp",
			Name:  "A MCP",
			Transport: &mcpv1.MCPServer_Stdio{
				Stdio: &mcpv1.MCPServerStdioTransport{Command: "npx", Args: []string{"-y", "@modelcontextprotocol/server-memory"}},
			},
		},
	)
	service, err := NewService(store, noopProfileReferenceUpdater{})
	if err != nil {
		t.Fatalf("NewService() error = %v", err)
	}

	items, err := service.List(context.Background())
	if err != nil {
		t.Fatalf("List() error = %v", err)
	}
	if got, want := len(items), 2; got != want {
		t.Fatalf("len(items) = %d, want %d", got, want)
	}
	if got, want := items[0].GetMcpId(), "a-mcp"; got != want {
		t.Fatalf("mcp_id = %q, want %q", got, want)
	}
	if got, want := items[0].GetTransportKind(), mcpv1.MCPTransportKind_MCP_TRANSPORT_KIND_STDIO; got != want {
		t.Fatalf("transport_kind = %v, want %v", got, want)
	}
}

type memoryMCPStore struct {
	items map[string]*MCPServer
}

func newMemoryMCPStore(t *testing.T, values ...*mcpv1.MCPServer) *memoryMCPStore {
	t.Helper()

	store := &memoryMCPStore{items: map[string]*MCPServer{}}
	for _, value := range values {
		mcp, err := NewMCPServer(value)
		if err != nil {
			t.Fatalf("NewMCPServer() error = %v", err)
		}
		store.items[mcp.ID()] = mcp
	}
	return store
}

func (s *memoryMCPStore) List(context.Context) ([]*MCPServer, error) {
	out := make([]*MCPServer, 0, len(s.items))
	for _, item := range s.items {
		out = append(out, item)
	}
	return out, nil
}

func (s *memoryMCPStore) Load(_ context.Context, mcpID string) (*MCPServer, error) {
	if item, ok := s.items[mcpID]; ok {
		return item, nil
	}
	return nil, domainerror.NewNotFound("test mcp %q not found", mcpID)
}

func (s *memoryMCPStore) Create(_ context.Context, mcp *MCPServer) error {
	s.items[mcp.ID()] = mcp
	return nil
}

func (s *memoryMCPStore) Update(_ context.Context, mcp *MCPServer) error {
	s.items[mcp.ID()] = mcp
	return nil
}

func (s *memoryMCPStore) Delete(_ context.Context, mcpID string) error {
	delete(s.items, mcpID)
	return nil
}

type noopProfileReferenceUpdater struct{}

func (noopProfileReferenceUpdater) DetachMCP(context.Context, string) error {
	return nil
}
