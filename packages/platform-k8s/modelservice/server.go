package modelservice

import (
	"context"
	"fmt"
	"log/slog"
	"strings"

	modelservicev1 "code-code.internal/go-contract/platform/model/v1"
	"code-code.internal/platform-k8s/domainevents"
	"code-code.internal/platform-k8s/internal/backgroundtasks"
	"code-code.internal/platform-k8s/modelcatalogsources"
	"code-code.internal/platform-k8s/models"
	"code-code.internal/platform-k8s/outboundhttp"
	"github.com/jackc/pgx/v5/pgxpool"
	ctrlclient "sigs.k8s.io/controller-runtime/pkg/client"
)

type Config struct {
	Client    ctrlclient.Client
	Reader    ctrlclient.Reader
	StatePool *pgxpool.Pool
	Outbox    *domainevents.Outbox
	Namespace string
	Logger    *slog.Logger
}

type Server struct {
	modelservicev1.UnimplementedModelServiceServer

	registry        modelRegistry
	syncer          *models.DefinitionSyncReconciler
	catalogSources  *modelcatalogsources.Registry
	backgroundTasks *backgroundtasks.Registry
}

type modelRegistry interface {
	List(context.Context, *modelservicev1.ListModelDefinitionsRequest) (*modelservicev1.ListModelDefinitionsResponse, error)
}

func NewServer(config Config) (*Server, error) {
	if config.Client == nil {
		return nil, fmt.Errorf("platformk8s/modelservice: client is nil")
	}
	if config.Reader == nil {
		config.Reader = config.Client
	}
	if strings.TrimSpace(config.Namespace) == "" {
		return nil, fmt.Errorf("platformk8s/modelservice: namespace is empty")
	}
	if config.Logger == nil {
		config.Logger = slog.Default()
	}
	probeExecutor, err := NewCatalogProbeExecutor(outboundhttp.NewClientFactory(), config.Client, config.Namespace)
	if err != nil {
		return nil, err
	}
	catalogSources, err := newCatalogSourceRegistry(context.Background(), config, probeExecutor)
	if err != nil {
		return nil, err
	}
	registry, err := newModelRegistry(config)
	if err != nil {
		return nil, err
	}
	syncer, err := models.NewDefinitionSyncReconciler(models.DefinitionSyncReconcilerConfig{
		Client:    config.Client,
		StatePool: config.StatePool,
		Outbox:    config.Outbox,
		Namespace: config.Namespace,
		Logger:    config.Logger,
	})
	if err != nil {
		return nil, err
	}
	backgroundTasks, err := newBackgroundTaskRegistry(config.Logger)
	if err != nil {
		return nil, err
	}
	return &Server{
		registry:        registry,
		syncer:          syncer,
		catalogSources:  catalogSources,
		backgroundTasks: backgroundTasks,
	}, nil
}

func newModelRegistry(config Config) (modelRegistry, error) {
	if config.StatePool == nil {
		return nil, fmt.Errorf("platformk8s/modelservice: model registry requires postgres state pool")
	}
	return models.NewManagementService(config.StatePool, config.Namespace)
}

func (s *Server) ListModelDefinitions(ctx context.Context, request *modelservicev1.ListModelDefinitionsRequest) (*modelservicev1.ListModelDefinitionsResponse, error) {
	response, err := s.registry.List(ctx, request)
	if err != nil {
		return nil, grpcError(err)
	}
	return response, nil
}

func (s *Server) GetOrFetchCatalogModels(ctx context.Context, request *modelservicev1.GetOrFetchCatalogModelsRequest) (*modelservicev1.GetOrFetchCatalogModelsResponse, error) {
	models, err := s.fetchCatalogModels(ctx, &modelservicev1.FetchCatalogModelsRequest{
		ProbeId: request.GetProbeId(),
		Target:  request.GetTarget(),
		AuthRef: request.GetAuthRef(),
	})
	if err != nil {
		return nil, err
	}
	return &modelservicev1.GetOrFetchCatalogModelsResponse{Models: models}, nil
}

func (s *Server) FetchCatalogModels(ctx context.Context, request *modelservicev1.FetchCatalogModelsRequest) (*modelservicev1.FetchCatalogModelsResponse, error) {
	models, err := s.fetchCatalogModels(ctx, request)
	if err != nil {
		return nil, err
	}
	return &modelservicev1.FetchCatalogModelsResponse{Models: models}, nil
}

func (s *Server) fetchCatalogModels(
	ctx context.Context,
	request *modelservicev1.FetchCatalogModelsRequest,
) ([]*modelservicev1.CatalogModel, error) {
	ref, err := catalogProbeRefFromProto(request.GetProbeId())
	if err != nil {
		return nil, grpcError(err)
	}
	models, err := s.catalogSources.ListModels(ctx, ref, request)
	if err != nil {
		return nil, grpcError(err)
	}
	return models, nil
}

func (s *Server) SyncModelDefinitions(ctx context.Context, _ *modelservicev1.SyncModelDefinitionsRequest) (*modelservicev1.SyncModelDefinitionsResponse, error) {
	status, err := s.triggerBackgroundTask(modelTaskDefinitionSync, s.runModelDefinitionSync)
	if err != nil {
		return nil, grpcError(err)
	}
	return &modelservicev1.SyncModelDefinitionsResponse{Status: status}, nil
}
