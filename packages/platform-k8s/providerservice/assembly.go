package providerservice

import (
	authv1 "code-code.internal/go-contract/platform/auth/v1"
	modelservicev1 "code-code.internal/go-contract/platform/model/v1"
	oauthv1 "code-code.internal/go-contract/platform/oauth/v1"
	cliidentity "code-code.internal/platform-k8s/clidefinitions/identity"
	clisupport "code-code.internal/platform-k8s/clidefinitions/support"
	"code-code.internal/platform-k8s/cliversions"
	"code-code.internal/platform-k8s/providercatalogs"
	"code-code.internal/platform-k8s/providerconnect"
	"code-code.internal/platform-k8s/providerobservability"
	"code-code.internal/platform-k8s/providers"
	"code-code.internal/platform-k8s/providersurfacebindings"
	"code-code.internal/platform-k8s/providersurfaces"
	"code-code.internal/platform-k8s/templates"
	vendoridentity "code-code.internal/platform-k8s/vendors/identity"
	vendorsupport "code-code.internal/platform-k8s/vendors/support"
)

func assembleServer(config Config) (*Server, error) {
	credentialService := newAuthCredentialService(authv1.NewAuthServiceClient(config.AuthConn))
	providerSurfaceBindings, err := providersurfacebindings.NewService(config.StatePool)
	if err != nil {
		return nil, err
	}
	vendors, err := vendoridentity.NewVendorManagementService()
	if err != nil {
		return nil, err
	}
	cliDefinitions, err := cliidentity.NewCLIDefinitionManagementService()
	if err != nil {
		return nil, err
	}
	vendorSupport, err := vendorsupport.NewManagementService()
	if err != nil {
		return nil, err
	}
	cliSupport, err := clisupport.NewManagementService()
	if err != nil {
		return nil, err
	}
	surfaceMetadata, err := providersurfaces.NewService(cliSupport, vendorSupport)
	if err != nil {
		return nil, err
	}
	providerRepository, err := providers.NewProviderRepository(config.StatePool)
	if err != nil {
		return nil, err
	}
	cliVersions, err := cliversions.NewPostgresStore(config.StatePool)
	if err != nil {
		return nil, err
	}
	templateService, err := templates.NewTemplateManagementService(config.Client, providerRepository)
	if err != nil {
		return nil, err
	}
	providerAccounts, err := providers.NewService(providers.Config{
		StatePool:   config.StatePool,
		Credentials: credentialService,
		Vendors:     vendors,
		CLIDefs:     cliSupportIconReferenceService{source: cliSupport},
		CLISupport:  cliSupport,
	})
	if err != nil {
		return nil, err
	}
	postConnect := config.PostConnect
	authClient := authv1.NewAuthServiceClient(config.AuthConn)
	modelClient := modelservicev1.NewModelServiceClient(config.ModelConn)
	catalogMaterializer := providercatalogs.NewCatalogMaterializer(modelCatalogClient{client: modelClient}, config.Logger)
	providerConnect, err := providerconnect.NewService(providerconnect.Config{
		Client:         config.Client,
		Reader:         config.Reader,
		Namespace:      config.Namespace,
		Credentials:    credentialService,
		Providers:      providerConnectSurfaceBindingAdapter{source: providerSurfaceBindings},
		ProviderReader: providerConnectProviderAdapter{source: providerAccounts},
		Surfaces:       surfaceMetadata,
		VendorSupport:  vendorSupport,
		CLISupport:     cliSupport,
		PostConnect:    postConnect,
		OAuthSessions:  newRemoteOAuthSessionService(oauthv1.NewOAuthSessionServiceClient(config.AuthConn)),
		Logger:         config.Logger,
	})
	if err != nil {
		return nil, err
	}
	oauthObservability, err := providerobservability.NewOAuthObservabilityRunner(providerobservability.OAuthObservabilityRunnerConfig{
		Client:              config.Client,
		Namespace:           config.Namespace,
		Providers:           providerRepository,
		CLIVersions:         cliVersions,
		CredentialFreshener: credentialService,
		Logger:              config.Logger,
	})
	if err != nil {
		return nil, err
	}
	vendorObservability, err := providerobservability.NewVendorObservabilityRunner(providerobservability.VendorObservabilityRunnerConfig{
		Client:    config.Client,
		Namespace: config.Namespace,
		Providers: providerRepository,
		Logger:    config.Logger,
	})
	if err != nil {
		return nil, err
	}
	providerObservability, err := providerobservability.NewService(providerobservability.Config{
		ProviderSurfaceBindings: providerSurfaceBindings,
		Capabilities: []providerobservability.Capability{
			oauthObservabilityCapability{runner: oauthObservability},
			vendorObservabilityCapability{runner: vendorObservability},
		},
	})
	if err != nil {
		return nil, err
	}
	return &Server{
		surfaceMetadata:         surfaceMetadata,
		authClient:              authClient,
		providers:               providerAccounts,
		providerSurfaceBindings: providerSurfaceBindings,
		providerConnect:         providerConnect,
		vendors:                 vendors,
		cliDefinitions:          cliDefinitions,
		templates:               templateService,
		providerObservability:   providerObservability,
		catalogDiscovery:        providercatalogs.NewMaterializationSyncer(providerRepository, catalogMaterializer, config.Logger),
		catalogBinding:          providercatalogs.NewBindingSyncer(providerRepository, modelRegistryClient{client: modelClient}, config.Logger),
	}, nil
}
