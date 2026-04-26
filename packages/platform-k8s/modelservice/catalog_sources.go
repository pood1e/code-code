package modelservice

import (
	"context"
	"strings"

	"code-code.internal/go-contract/domainerror"
	clisupport "code-code.internal/platform-k8s/clidefinitions/support"
	"code-code.internal/platform-k8s/cliversions"
	"code-code.internal/platform-k8s/modelcatalogsources"
	catalogclis "code-code.internal/platform-k8s/modelcatalogsources/clis"
	catalogsurfaces "code-code.internal/platform-k8s/modelcatalogsources/surfaces"
)

func newCatalogSourceRegistry(
	ctx context.Context,
	config Config,
	probe modelcatalogsources.ModelIDProbe,
) (*modelcatalogsources.Registry, error) {
	registry := modelcatalogsources.NewRegistry()
	if err := catalogsurfaces.Register(registry, catalogsurfaces.RegisterConfig{Probe: probe}); err != nil {
		return nil, err
	}
	cliSupport, err := clisupport.NewManagementService()
	if err != nil {
		return nil, err
	}
	versionStore, err := cliversions.NewPostgresStore(config.StatePool)
	if err != nil {
		return nil, err
	}
	if err := catalogclis.Register(ctx, registry, catalogclis.RegisterConfig{
		Support:      cliSupport,
		Probe:        probe,
		Reader:       config.Reader,
		VersionStore: versionStore,
		Namespace:    config.Namespace,
	}); err != nil {
		return nil, err
	}
	return registry, nil
}

func catalogProbeRefFromProto(probeID string) (modelcatalogsources.CapabilityRef, error) {
	probeID = strings.TrimSpace(probeID)
	if probeID == "" {
		return modelcatalogsources.CapabilityRef{}, domainerror.NewValidation("platformk8s/modelservice: model catalog probe id is empty")
	}
	return modelcatalogsources.ProbeRef(probeID), nil
}
