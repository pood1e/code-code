package mcpservers

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"code-code.internal/go-contract/domainerror"
	mcpv1 "code-code.internal/go-contract/platform/mcp/v1"
	statepostgres "code-code.internal/platform-k8s/internal/platform/state/postgres"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"google.golang.org/protobuf/encoding/protojson"
)

const postgresMCPTable = "platform_mcp_servers"

type Store interface {
	List(context.Context) ([]*MCPServer, error)
	Load(context.Context, string) (*MCPServer, error)
	Create(context.Context, *MCPServer) error
	Update(context.Context, *MCPServer) error
	Delete(context.Context, string) error
}

type Repository struct {
	resources *statepostgres.JSONRepository
}

func NewRepository(pool *pgxpool.Pool) (*Repository, error) {
	resources, err := statepostgres.NewJSONRepository(pool, postgresMCPTable)
	if err != nil {
		return nil, err
	}
	return &Repository{resources: resources}, nil
}

func (r *Repository) List(ctx context.Context) ([]*MCPServer, error) {
	if r == nil || r.resources == nil {
		return nil, fmt.Errorf("platformk8s/mcpservers: repository is not initialized")
	}
	records, err := r.resources.List(ctx)
	if err != nil {
		return nil, err
	}
	items := make([]*MCPServer, 0, len(records))
	for _, record := range records {
		mcp, err := unmarshalMCP(record.ID, record.Payload)
		if err != nil {
			return nil, err
		}
		items = append(items, mcp)
	}
	return items, nil
}

func (r *Repository) Load(ctx context.Context, mcpID string) (*MCPServer, error) {
	if r == nil || r.resources == nil {
		return nil, fmt.Errorf("platformk8s/mcpservers: repository is not initialized")
	}
	mcpID = strings.TrimSpace(mcpID)
	if mcpID == "" {
		return nil, domainerror.NewValidation("platformk8s/mcpservers: mcp id is empty")
	}
	payload, _, err := r.resources.Get(ctx, mcpID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, mcpNotFound(mcpID)
		}
		return nil, err
	}
	return unmarshalMCP(mcpID, payload)
}

func (r *Repository) Create(ctx context.Context, mcp *MCPServer) error {
	if r == nil || r.resources == nil {
		return fmt.Errorf("platformk8s/mcpservers: repository is not initialized")
	}
	payload, id, err := marshalMCP(mcp)
	if err != nil {
		return err
	}
	if _, err := r.resources.Insert(ctx, id, payload); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domainerror.NewAlreadyExists("platformk8s/mcpservers: mcp %q already exists", id)
		}
		return err
	}
	return nil
}

func (r *Repository) Update(ctx context.Context, mcp *MCPServer) error {
	if r == nil || r.resources == nil {
		return fmt.Errorf("platformk8s/mcpservers: repository is not initialized")
	}
	payload, id, err := marshalMCP(mcp)
	if err != nil {
		return err
	}
	if _, err := r.resources.Update(ctx, id, payload); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return mcpNotFound(id)
		}
		return err
	}
	return nil
}

func (r *Repository) Delete(ctx context.Context, mcpID string) error {
	if r == nil || r.resources == nil {
		return fmt.Errorf("platformk8s/mcpservers: repository is not initialized")
	}
	mcpID = strings.TrimSpace(mcpID)
	if mcpID == "" {
		return domainerror.NewValidation("platformk8s/mcpservers: mcp id is empty")
	}
	return r.resources.Delete(ctx, mcpID)
}

func marshalMCP(mcp *MCPServer) ([]byte, string, error) {
	if mcp == nil {
		return nil, "", domainerror.NewValidation("platformk8s/mcpservers: mcp is nil")
	}
	value := mcp.Proto()
	id := strings.TrimSpace(value.GetMcpId())
	if id == "" {
		return nil, "", domainerror.NewValidation("platformk8s/mcpservers: mcp id is empty")
	}
	payload, err := protojson.MarshalOptions{EmitUnpopulated: false}.Marshal(value)
	if err != nil {
		return nil, "", fmt.Errorf("platformk8s/mcpservers: marshal mcp %q: %w", id, err)
	}
	return payload, id, nil
}

func unmarshalMCP(id string, payload []byte) (*MCPServer, error) {
	value := &mcpv1.MCPServer{}
	if err := (protojson.UnmarshalOptions{DiscardUnknown: true}).Unmarshal(payload, value); err != nil {
		return nil, fmt.Errorf("platformk8s/mcpservers: unmarshal mcp %q: %w", id, err)
	}
	return mcpServerFromStored(id, value)
}

func mcpNotFound(mcpID string) error {
	return domainerror.NewNotFound("platformk8s/mcpservers: mcp %q not found", mcpID)
}
