package profileservice

import (
	"fmt"

	cliruntimev1 "code-code.internal/go-contract/platform/cli_runtime/v1"
	profileservicev1 "code-code.internal/go-contract/platform/profile/v1"
	providerservicev1 "code-code.internal/go-contract/platform/provider/v1"
	supportv1 "code-code.internal/go-contract/platform/support/v1"
	"code-code.internal/platform-k8s/agentprofiles"
	"code-code.internal/platform-k8s/mcpservers"
	"code-code.internal/platform-k8s/rules"
	"code-code.internal/platform-k8s/skills"
	"github.com/jackc/pgx/v5/pgxpool"
	"google.golang.org/grpc"
)

const deleteStatusDeleted = "deleted"

type Config struct {
	ProviderConn   grpc.ClientConnInterface
	CLIRuntimeConn grpc.ClientConnInterface
	SupportConn    grpc.ClientConnInterface
	StatePool      *pgxpool.Pool
}

type Server struct {
	profileservicev1.UnimplementedProfileServiceServer

	profiles *agentprofiles.Service
	mcps     *mcpservers.Service
	skills   *skills.Service
	rules    *rules.Service
}

func NewServer(config Config) (*Server, error) {
	if config.ProviderConn == nil {
		return nil, fmt.Errorf("platformk8s/profileservice: provider service connection is nil")
	}
	if config.CLIRuntimeConn == nil {
		return nil, fmt.Errorf("platformk8s/profileservice: cli runtime service connection is nil")
	}
	if config.SupportConn == nil {
		return nil, fmt.Errorf("platformk8s/profileservice: support service connection is nil")
	}
	if config.StatePool == nil {
		return nil, fmt.Errorf("platformk8s/profileservice: state pool is nil")
	}
	providerReferences := newProviderReferenceClient(
		providerservicev1.NewProviderServiceClient(config.ProviderConn),
		cliruntimev1.NewCLIRuntimeServiceClient(config.CLIRuntimeConn),
		supportv1.NewSupportServiceClient(config.SupportConn),
	)
	profileStore, err := agentprofiles.NewPostgresProfileStore(config.StatePool)
	if err != nil {
		return nil, err
	}
	mcpStore, err := mcpservers.NewRepository(config.StatePool)
	if err != nil {
		return nil, err
	}
	skillStore, err := skills.NewRepository(config.StatePool)
	if err != nil {
		return nil, err
	}
	ruleStore, err := rules.NewRepository(config.StatePool)
	if err != nil {
		return nil, err
	}
	resourceReferences := resourceReferences{
		mcps:   mcpStore,
		skills: skillStore,
		rules:  ruleStore,
	}
	profiles, err := agentprofiles.NewService(agentprofiles.Config{
		Store:              profileStore,
		ProviderReferences: providerReferences,
		ResourceReferences: resourceReferences,
	})
	if err != nil {
		return nil, err
	}
	mcps, err := mcpservers.NewService(mcpStore, profiles)
	if err != nil {
		return nil, err
	}
	skillService, err := skills.NewService(skillStore, profiles)
	if err != nil {
		return nil, err
	}
	ruleService, err := rules.NewService(ruleStore, profiles)
	if err != nil {
		return nil, err
	}
	return &Server{
		profiles: profiles,
		mcps:     mcps,
		skills:   skillService,
		rules:    ruleService,
	}, nil
}
