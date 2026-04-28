package mcpservers

import (
	"context"
	"fmt"
	"slices"
	"strings"

	managementv1 "code-code.internal/go-contract/platform/management/v1"
	mcpv1 "code-code.internal/go-contract/platform/mcp/v1"
	"google.golang.org/protobuf/proto"
)

type ProfileReferenceUpdater interface {
	DetachMCP(ctx context.Context, mcpID string) error
}

type Service struct {
	store    Store
	profiles ProfileReferenceUpdater
}

func NewService(store Store, profiles ProfileReferenceUpdater) (*Service, error) {
	if store == nil {
		return nil, fmt.Errorf("platformk8s/mcpservers: store is nil")
	}
	if profiles == nil {
		return nil, fmt.Errorf("platformk8s/mcpservers: profile reference updater is nil")
	}
	return &Service{
		store:    store,
		profiles: profiles,
	}, nil
}

func (s *Service) List(ctx context.Context) ([]*managementv1.MCPServerListItem, error) {
	mcps, err := s.store.List(ctx)
	if err != nil {
		return nil, fmt.Errorf("platformk8s/mcpservers: list mcps: %w", err)
	}
	items := make([]*managementv1.MCPServerListItem, 0, len(mcps))
	for _, mcp := range mcps {
		items = append(items, mcp.ListItem())
	}
	slices.SortFunc(items, func(a, b *managementv1.MCPServerListItem) int {
		if a.GetName() != b.GetName() {
			return strings.Compare(a.GetName(), b.GetName())
		}
		return strings.Compare(a.GetMcpId(), b.GetMcpId())
	})
	return items, nil
}

func (s *Service) Get(ctx context.Context, mcpID string) (*mcpv1.MCPServer, error) {
	mcp, err := s.store.Load(ctx, mcpID)
	if err != nil {
		return nil, err
	}
	return mcp.Proto(), nil
}

func (s *Service) Create(ctx context.Context, input *mcpv1.MCPServer) (*mcpv1.MCPServer, error) {
	mcp, err := NewMCPServer(input)
	if err != nil {
		return nil, err
	}
	if err := s.store.Create(ctx, mcp); err != nil {
		return nil, err
	}
	return mcp.Proto(), nil
}

func (s *Service) Update(ctx context.Context, mcpID string, input *mcpv1.MCPServer) (*mcpv1.MCPServer, error) {
	mcp, err := NewMCPServer(mcpWithID(input, mcpID))
	if err != nil {
		return nil, err
	}
	if err := s.store.Update(ctx, mcp); err != nil {
		return nil, err
	}
	return mcp.Proto(), nil
}

func (s *Service) Delete(ctx context.Context, mcpID string) error {
	nextMCPID, err := NormalizeMCPServerID(mcpID)
	if err != nil {
		return err
	}
	if err := s.profiles.DetachMCP(ctx, nextMCPID); err != nil {
		return err
	}
	return s.store.Delete(ctx, nextMCPID)
}

func mcpWithID(input *mcpv1.MCPServer, mcpID string) *mcpv1.MCPServer {
	next := &mcpv1.MCPServer{}
	if input != nil {
		next = proto.Clone(input).(*mcpv1.MCPServer)
	}
	next.McpId = strings.TrimSpace(mcpID)
	return next
}
