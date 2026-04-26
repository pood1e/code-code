package profileservice

import (
	"context"

	managementv1 "code-code.internal/go-contract/platform/management/v1"
	mcpv1 "code-code.internal/go-contract/platform/mcp/v1"
)

func (s *Server) ListMCPServers(ctx context.Context, _ *managementv1.ListMCPServersRequest) (*managementv1.ListMCPServersResponse, error) {
	items, err := s.mcps.List(ctx)
	if err != nil {
		return nil, grpcError(err)
	}
	return &managementv1.ListMCPServersResponse{Items: items}, nil
}

func (s *Server) GetMCPServer(ctx context.Context, request *managementv1.GetMCPServerRequest) (*managementv1.GetMCPServerResponse, error) {
	mcp, err := s.mcps.Get(ctx, request.GetMcpId())
	if err != nil {
		return nil, grpcError(err)
	}
	return &managementv1.GetMCPServerResponse{Mcp: mcp}, nil
}

func (s *Server) CreateMCPServer(ctx context.Context, request *managementv1.CreateMCPServerRequest) (*managementv1.CreateMCPServerResponse, error) {
	mcp, err := s.mcps.Create(ctx, mcpServerFromUpsertRequest(request.GetMcp()))
	if err != nil {
		return nil, grpcError(err)
	}
	return &managementv1.CreateMCPServerResponse{Mcp: mcp}, nil
}

func (s *Server) UpdateMCPServer(ctx context.Context, request *managementv1.UpdateMCPServerRequest) (*managementv1.UpdateMCPServerResponse, error) {
	mcp, err := s.mcps.Update(ctx, request.GetMcpId(), mcpServerFromUpsertRequest(request.GetMcp()))
	if err != nil {
		return nil, grpcError(err)
	}
	return &managementv1.UpdateMCPServerResponse{Mcp: mcp}, nil
}

func (s *Server) DeleteMCPServer(ctx context.Context, request *managementv1.DeleteMCPServerRequest) (*managementv1.DeleteMCPServerResponse, error) {
	if err := s.mcps.Delete(ctx, request.GetMcpId()); err != nil {
		return nil, grpcError(err)
	}
	return &managementv1.DeleteMCPServerResponse{Status: deleteStatusDeleted}, nil
}

func mcpServerFromUpsertRequest(request *managementv1.UpsertMCPServerRequest) *mcpv1.MCPServer {
	if request == nil {
		return nil
	}
	mcp := &mcpv1.MCPServer{McpId: request.GetMcpId(), Name: request.GetName()}
	if stdio := request.GetStdio(); stdio != nil {
		mcp.Transport = &mcpv1.MCPServer_Stdio{Stdio: &mcpv1.MCPServerStdioTransport{
			Command: stdio.GetCommand(),
			Args:    append([]string(nil), stdio.GetArgs()...),
			Env:     copyMCPEnvVars(stdio.GetEnv()),
		}}
		return mcp
	}
	if streamable := request.GetStreamableHttp(); streamable != nil {
		mcp.Transport = &mcpv1.MCPServer_StreamableHttp{StreamableHttp: &mcpv1.MCPServerStreamableHTTPTransport{
			EndpointUrl: streamable.GetEndpointUrl(),
			Headers:     copyMCPHeaders(streamable.GetHeaders()),
		}}
	}
	return mcp
}

func copyMCPEnvVars(items []*mcpv1.MCPServerEnvVar) []*mcpv1.MCPServerEnvVar {
	env := make([]*mcpv1.MCPServerEnvVar, 0, len(items))
	for _, item := range items {
		env = append(env, &mcpv1.MCPServerEnvVar{Name: item.GetName(), Value: item.GetValue()})
	}
	return env
}

func copyMCPHeaders(items []*mcpv1.MCPServerHeader) []*mcpv1.MCPServerHeader {
	headers := make([]*mcpv1.MCPServerHeader, 0, len(items))
	for _, item := range items {
		headers = append(headers, &mcpv1.MCPServerHeader{Name: item.GetName(), Value: item.GetValue()})
	}
	return headers
}
