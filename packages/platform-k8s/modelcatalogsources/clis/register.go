package clis

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	modelv1 "code-code.internal/go-contract/model/v1"
	modelcatalogdiscoveryv1 "code-code.internal/go-contract/model_catalog_discovery/v1"
	modelservicev1 "code-code.internal/go-contract/platform/model/v1"
	supportv1 "code-code.internal/go-contract/platform/support/v1"
	providerv1 "code-code.internal/go-contract/provider/v1"
	clioauth "code-code.internal/platform-k8s/clidefinitions/oauth"
	clisupport "code-code.internal/platform-k8s/clidefinitions/support"
	"code-code.internal/platform-k8s/cliversions"
	"code-code.internal/platform-k8s/egressauth"
	"code-code.internal/platform-k8s/modelcatalogsources"
	"google.golang.org/protobuf/proto"
	ctrlclient "sigs.k8s.io/controller-runtime/pkg/client"
)

type CLISupportReader interface {
	List(context.Context) ([]*supportv1.CLI, error)
}

type RegisterConfig struct {
	Support      CLISupportReader
	Probe        modelcatalogsources.ModelIDProbe
	Reader       ctrlclient.Reader
	VersionStore cliversions.Store
	Namespace    string
}

func Register(ctx context.Context, registry *modelcatalogsources.Registry, config RegisterConfig) error {
	if registry == nil {
		return fmt.Errorf("platformk8s/modelcatalogsources/clis: registry is nil")
	}
	if config.Support == nil {
		return fmt.Errorf("platformk8s/modelcatalogsources/clis: cli support reader is nil")
	}
	clis, err := config.Support.List(ctx)
	if err != nil {
		return err
	}
	for _, cli := range clis {
		cliID := strings.TrimSpace(cli.GetCliId())
		if cliID == "" {
			return fmt.Errorf("platformk8s/modelcatalogsources/clis: cli support id is empty")
		}
		if hasDefaultCatalog(cli) {
			if err := registry.Register(&cliSource{
				ref: modelcatalogsources.ProbeRef("cli." + cliID),
				cli: proto.Clone(cli).(*supportv1.CLI),
			}); err != nil {
				return err
			}
		}
		if _, operation, err := clioauth.ResolveOAuthModelCatalogDiscovery(cli); err != nil {
			return err
		} else if operation != nil && config.Probe != nil {
			probeID := strings.TrimSpace(clisupport.OAuthModelCatalogProbeID(cli))
			if probeID == "" {
				continue
			}
			if err := registry.Register(&cliSource{
				ref:          modelcatalogsources.ProbeRef(probeID),
				cli:          proto.Clone(cli).(*supportv1.CLI),
				operation:    operation,
				probe:        config.Probe,
				reader:       config.Reader,
				versionStore: config.VersionStore,
				namespace:    strings.TrimSpace(config.Namespace),
			}); err != nil {
				return err
			}
		}
	}
	return nil
}

func hasDefaultCatalog(cli *supportv1.CLI) bool {
	if cli == nil || cli.GetOauth() == nil || cli.GetOauth().GetModelCatalog() == nil {
		return false
	}
	return cli.GetOauth().GetModelCatalog().GetDefaultCatalog() != nil
}

type cliSource struct {
	ref          modelcatalogsources.CapabilityRef
	cli          *supportv1.CLI
	operation    *modelcatalogdiscoveryv1.ModelCatalogDiscoveryOperation
	probe        modelcatalogsources.ModelIDProbe
	reader       ctrlclient.Reader
	versionStore cliversions.Store
	namespace    string
}

func (s *cliSource) CapabilityRef() modelcatalogsources.CapabilityRef {
	return s.ref
}

func (s *cliSource) ListModels(ctx context.Context, request *modelservicev1.FetchCatalogModelsRequest) ([]*modelservicev1.CatalogModel, error) {
	if s.operation != nil {
		return s.listAuthenticatedModels(ctx, request)
	}
	models := s.defaultCatalogDefinitions()
	if len(models) == 0 {
		return nil, fmt.Errorf("platformk8s/modelcatalogsources/clis: cli %q has no model catalog source data", s.ref.ID)
	}
	out := make([]*modelservicev1.CatalogModel, 0, len(models))
	for _, definition := range models {
		modelID := strings.TrimSpace(definition.GetModelId())
		if modelID == "" {
			continue
		}
		out = append(out, &modelservicev1.CatalogModel{
			SourceModelId: modelID,
			Definition:    definition,
		})
	}
	return out, nil
}

func (s *cliSource) listAuthenticatedModels(ctx context.Context, request *modelservicev1.FetchCatalogModelsRequest) ([]*modelservicev1.CatalogModel, error) {
	if s.probe == nil {
		return nil, fmt.Errorf("platformk8s/modelcatalogsources/clis: model catalog probe is nil for %q", s.ref.ID)
	}
	credentialID := strings.TrimSpace(request.GetAuthRef().GetCredentialId())
	if credentialID == "" {
		return nil, fmt.Errorf("platformk8s/modelcatalogsources/clis: auth_ref is required for %q", s.ref.ID)
	}
	values, err := clioauth.ResolveOAuthDiscoveryDynamicValues(ctx, s.reader, s.versionStore, s.namespace, s.cli.GetCliId(), credentialID)
	if err != nil {
		return nil, err
	}
	modelIDs, err := s.probe.ProbeModelIDs(ctx, modelcatalogsources.ProbeRequest{
		ProbeID:        s.ref.ID,
		AuthRef:        request.GetAuthRef(),
		Headers:        clioauth.ApplyOAuthProbeClientIdentityHeaders(http.Header{}, s.cli, values.ClientVersion),
		Operation:      operationWithOAuthAuthInjection(s.cli, s.operation),
		DynamicValues:  values,
		ConcurrencyKey: s.ref.ID,
	})
	if err != nil {
		return nil, err
	}
	catalog, err := clioauth.BuildOAuthProbeCatalog(s.cli, modelIDs, time.Now())
	if err != nil {
		return nil, err
	}
	return catalogModelsFromSurfaceCatalog(catalog), nil
}

func operationWithOAuthAuthInjection(
	cli *supportv1.CLI,
	operation *modelcatalogdiscoveryv1.ModelCatalogDiscoveryOperation,
) *modelcatalogdiscoveryv1.ModelCatalogDiscoveryOperation {
	if operation == nil {
		return nil
	}
	next := proto.Clone(operation).(*modelcatalogdiscoveryv1.ModelCatalogDiscoveryOperation)
	for _, header := range next.GetRequestHeaders() {
		if strings.Contains(header.GetLiteral(), egressauth.Placeholder) {
			return next
		}
	}
	injection := cli.GetOauth().GetAuthMaterialization().GetRequestAuthInjection()
	for _, rawName := range injection.GetHeaderNames() {
		name := strings.TrimSpace(rawName)
		if name == "" {
			continue
		}
		next.RequestHeaders = append(next.RequestHeaders, &modelcatalogdiscoveryv1.DiscoveryParameter{
			Name: name,
			Value: &modelcatalogdiscoveryv1.DiscoveryParameter_Literal{
				Literal: injection.GetHeaderValuePrefix() + egressauth.Placeholder,
			},
		})
	}
	return next
}

func (s *cliSource) defaultCatalogDefinitions() []*modelv1.ModelDefinition {
	catalog := s.cli.GetOauth().GetModelCatalog().GetDefaultCatalog()
	if catalog == nil {
		return nil
	}
	fallbackVendorID := strings.TrimSpace(s.cli.GetVendorId())
	out := make([]*modelv1.ModelDefinition, 0, len(catalog.GetModels()))
	seen := map[string]struct{}{}
	for _, entry := range catalog.GetModels() {
		modelID := strings.TrimSpace(entry.GetModelRef().GetModelId())
		if modelID == "" {
			modelID = strings.TrimSpace(entry.GetProviderModelId())
		}
		vendorID := strings.TrimSpace(entry.GetModelRef().GetVendorId())
		if vendorID == "" {
			vendorID = fallbackVendorID
		}
		if modelID == "" || vendorID == "" {
			continue
		}
		key := vendorID + "\x00" + modelID
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		out = append(out, &modelv1.ModelDefinition{
			VendorId:    vendorID,
			ModelId:     modelID,
			DisplayName: modelID,
		})
	}
	return out
}

func catalogModelsFromSurfaceCatalog(catalog *providerv1.ProviderModelCatalog) []*modelservicev1.CatalogModel {
	out := make([]*modelservicev1.CatalogModel, 0, len(catalog.GetModels()))
	for _, entry := range catalog.GetModels() {
		modelID := strings.TrimSpace(entry.GetProviderModelId())
		if modelID == "" {
			modelID = strings.TrimSpace(entry.GetModelRef().GetModelId())
		}
		vendorID := strings.TrimSpace(entry.GetModelRef().GetVendorId())
		if modelID == "" {
			continue
		}
		out = append(out, &modelservicev1.CatalogModel{
			SourceModelId: modelID,
			Definition: &modelv1.ModelDefinition{
				VendorId:    vendorID,
				ModelId:     modelID,
				DisplayName: modelID,
			},
		})
	}
	return out
}
