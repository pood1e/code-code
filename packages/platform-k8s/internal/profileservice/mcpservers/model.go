package mcpservers

import (
	"strings"

	"code-code.internal/go-contract/domainerror"
	managementv1 "code-code.internal/go-contract/platform/management/v1"
	mcpv1 "code-code.internal/go-contract/platform/mcp/v1"
	"code-code.internal/platform-k8s/internal/platform/resourcemeta"
	"google.golang.org/protobuf/proto"
)

type MCPServer struct {
	value *mcpv1.MCPServer
}

func NewMCPServer(input *mcpv1.MCPServer) (*MCPServer, error) {
	if input == nil {
		return nil, domainerror.NewValidation("platformk8s/mcpservers: mcp is nil")
	}
	name := strings.TrimSpace(input.GetName())
	if name == "" {
		return nil, domainerror.NewValidation("platformk8s/mcpservers: mcp name is required")
	}
	mcpID, err := resourcemeta.EnsureResourceID(strings.TrimSpace(input.GetMcpId()), name, "mcp")
	if err != nil {
		return nil, err
	}
	if stdio := input.GetStdio(); stdio != nil {
		command := strings.TrimSpace(stdio.GetCommand())
		if command == "" {
			return nil, domainerror.NewValidation("platformk8s/mcpservers: stdio command is required")
		}
		env := make([]*mcpv1.MCPServerEnvVar, 0, len(stdio.GetEnv()))
		for _, item := range stdio.GetEnv() {
			if strings.TrimSpace(item.GetName()) == "" {
				return nil, domainerror.NewValidation("platformk8s/mcpservers: stdio env name is required")
			}
			env = append(env, &mcpv1.MCPServerEnvVar{Name: strings.TrimSpace(item.GetName()), Value: item.GetValue()})
		}
		return &MCPServer{
			value: &mcpv1.MCPServer{
				McpId: mcpID,
				Name:  name,
				Transport: &mcpv1.MCPServer_Stdio{Stdio: &mcpv1.MCPServerStdioTransport{
					Command: command,
					Args:    append([]string(nil), stdio.GetArgs()...),
					Env:     env,
				}},
			},
		}, nil
	}
	streamable := input.GetStreamableHttp()
	if streamable == nil || strings.TrimSpace(streamable.GetEndpointUrl()) == "" {
		return nil, domainerror.NewValidation("platformk8s/mcpservers: streamable http endpoint is required")
	}
	headers := make([]*mcpv1.MCPServerHeader, 0, len(streamable.GetHeaders()))
	for _, item := range streamable.GetHeaders() {
		if strings.TrimSpace(item.GetName()) == "" {
			return nil, domainerror.NewValidation("platformk8s/mcpservers: streamable http header name is required")
		}
		headers = append(headers, &mcpv1.MCPServerHeader{Name: strings.TrimSpace(item.GetName()), Value: item.GetValue()})
	}
	return &MCPServer{
		value: &mcpv1.MCPServer{
			McpId: mcpID,
			Name:  name,
			Transport: &mcpv1.MCPServer_StreamableHttp{StreamableHttp: &mcpv1.MCPServerStreamableHTTPTransport{
				EndpointUrl: strings.TrimSpace(streamable.GetEndpointUrl()),
				Headers:     headers,
			}},
		},
	}, nil
}

func mcpServerFromStored(id string, value *mcpv1.MCPServer) (*MCPServer, error) {
	if value == nil {
		return nil, domainerror.NewValidation("platformk8s/mcpservers: mcp is nil")
	}
	next := proto.Clone(value).(*mcpv1.MCPServer)
	id = strings.TrimSpace(id)
	if next.GetMcpId() == "" {
		next.McpId = id
	}
	if next.GetMcpId() != id {
		return nil, domainerror.NewValidation("platformk8s/mcpservers: mcp id %q does not match stored id %q", next.GetMcpId(), id)
	}
	return NewMCPServer(next)
}

func NormalizeMCPServerID(mcpID string) (string, error) {
	mcpID = strings.TrimSpace(mcpID)
	if mcpID == "" {
		return "", domainerror.NewValidation("platformk8s/mcpservers: mcp id is empty")
	}
	return mcpID, nil
}

func (m *MCPServer) ID() string {
	if m == nil || m.value == nil {
		return ""
	}
	return strings.TrimSpace(m.value.GetMcpId())
}

func (m *MCPServer) Proto() *mcpv1.MCPServer {
	if m == nil || m.value == nil {
		return nil
	}
	return proto.Clone(m.value).(*mcpv1.MCPServer)
}

func (m *MCPServer) ListItem() *managementv1.MCPServerListItem {
	if m == nil || m.value == nil {
		return &managementv1.MCPServerListItem{}
	}
	item := &managementv1.MCPServerListItem{
		McpId: m.value.GetMcpId(),
		Name:  m.value.GetName(),
	}
	if stdio := m.value.GetStdio(); stdio != nil {
		item.TransportKind = mcpv1.MCPTransportKind_MCP_TRANSPORT_KIND_STDIO
		item.TransportSummary = "stdio: " + stdio.GetCommand()
		return item
	}
	item.TransportKind = mcpv1.MCPTransportKind_MCP_TRANSPORT_KIND_STREAMABLE_HTTP
	item.TransportSummary = "streamable-http: " + m.value.GetStreamableHttp().GetEndpointUrl()
	return item
}
