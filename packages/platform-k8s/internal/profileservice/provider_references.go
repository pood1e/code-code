package profileservice

import (
	"context"
	"errors"
	"strings"

	"code-code.internal/go-contract/domainerror"
	cliruntimev1 "code-code.internal/go-contract/platform/cli_runtime/v1"
	providerservicev1 "code-code.internal/go-contract/platform/provider/v1"
	supportv1 "code-code.internal/go-contract/platform/support/v1"
)

type providerReferenceClient struct {
	providers  providerservicev1.ProviderServiceClient
	cliRuntime cliruntimev1.CLIRuntimeServiceClient
	support    supportv1.SupportServiceClient
}

func newProviderReferenceClient(
	providers providerservicev1.ProviderServiceClient,
	cliRuntime cliruntimev1.CLIRuntimeServiceClient,
	support supportv1.SupportServiceClient,
) *providerReferenceClient {
	return &providerReferenceClient{providers: providers, cliRuntime: cliRuntime, support: support}
}

func (c *providerReferenceClient) ProviderExists(ctx context.Context, providerID string) error {
	providerID = strings.TrimSpace(providerID)
	if _, err := c.cliSupport(ctx, providerID); err == nil {
		return nil
	} else if !isDomainNotFound(err) {
		return err
	}
	if _, err := c.cliDefinition(ctx, providerID); err == nil {
		return nil
	} else {
		return err
	}
}

func (c *providerReferenceClient) ExecutionClassExists(ctx context.Context, providerID, executionClass string) error {
	definition, err := c.cliDefinition(ctx, providerID)
	if err != nil {
		return err
	}
	executionClass = strings.TrimSpace(executionClass)
	declared := false
	for _, image := range definition.GetContainerImages() {
		if strings.TrimSpace(image.GetExecutionClass()) == executionClass {
			declared = true
			break
		}
	}
	if !declared {
		return domainerror.NewValidation("platformk8s/profileservice: execution class %q is not declared by cli definition %q", executionClass, providerID)
	}
	response, err := c.cliRuntime.GetLatestAvailableCLIRuntimeImages(ctx, &cliruntimev1.GetLatestAvailableCLIRuntimeImagesRequest{
		CliId: strings.TrimSpace(providerID),
	})
	if err != nil {
		return err
	}
	for _, image := range response.GetItems() {
		if strings.TrimSpace(image.GetCliId()) == strings.TrimSpace(providerID) && strings.TrimSpace(image.GetExecutionClass()) == executionClass && strings.TrimSpace(image.GetImage()) != "" {
			return nil
		}
	}
	return domainerror.NewValidation("platformk8s/profileservice: no available runtime image for cli definition %q execution class %q", providerID, executionClass)
}

func (c *providerReferenceClient) SurfaceExists(ctx context.Context, surfaceID string) error {
	surfaceID = strings.TrimSpace(surfaceID)
	response, err := c.providers.ListProviderSurfaceBindings(ctx, &providerservicev1.ListProviderSurfaceBindingsRequest{})
	if err != nil {
		return err
	}
	for _, item := range response.GetItems() {
		if strings.TrimSpace(item.GetSurfaceId()) == surfaceID {
			return nil
		}
	}
	return domainerror.NewNotFound("platformk8s/profileservice: provider surface binding %q not found", surfaceID)
}

func (c *providerReferenceClient) RuntimeCapabilitySupported(ctx context.Context, providerID, kind string) error {
	cli, err := c.cliSupport(ctx, providerID)
	if err != nil {
		if !isDomainNotFound(err) {
			return err
		}
		return profileReferenceValidation("provider %q does not declare runtime capabilities required for %s resources", providerID, kind)
	}
	target := runtimeCapabilityKind(kind)
	if target == supportv1.RuntimeCapabilityKind_RUNTIME_CAPABILITY_KIND_UNSPECIFIED {
		return profileReferenceValidation("unsupported reference kind %q", kind)
	}
	for _, capability := range cli.GetRuntimeCapabilities() {
		if capability.GetKind() == target {
			if capability.GetSupported() {
				return nil
			}
			return profileReferenceValidation("provider %q does not support %s resources", providerID, kind)
		}
	}
	return profileReferenceValidation("provider %q does not support %s resources", providerID, kind)
}

func (c *providerReferenceClient) cliDefinition(ctx context.Context, cliID string) (*providerservicev1.CLIDefinitionView, error) {
	response, err := c.providers.ListCLIDefinitions(ctx, &providerservicev1.ListCLIDefinitionsRequest{})
	if err != nil {
		return nil, err
	}
	cliID = strings.TrimSpace(cliID)
	for _, item := range response.GetItems() {
		if strings.TrimSpace(item.GetCliId()) == cliID {
			return item, nil
		}
	}
	return nil, domainerror.NewNotFound("platformk8s/profileservice: cli definition %q not found", cliID)
}

func (c *providerReferenceClient) cliSupport(ctx context.Context, cliID string) (*supportv1.CLI, error) {
	response, err := c.support.GetCLI(ctx, &supportv1.GetCLIRequest{CliId: strings.TrimSpace(cliID)})
	if err != nil {
		return nil, err
	}
	item := response.GetItem()
	if item != nil && strings.TrimSpace(item.GetCliId()) == strings.TrimSpace(cliID) {
		return item, nil
	}
	return nil, domainerror.NewNotFound("platformk8s/profileservice: cli support %q not found", cliID)
}

func runtimeCapabilityKind(kind string) supportv1.RuntimeCapabilityKind {
	switch kind {
	case "skill":
		return supportv1.RuntimeCapabilityKind_RUNTIME_CAPABILITY_KIND_SKILL
	case "rule":
		return supportv1.RuntimeCapabilityKind_RUNTIME_CAPABILITY_KIND_RULE
	case "mcp":
		return supportv1.RuntimeCapabilityKind_RUNTIME_CAPABILITY_KIND_MCP
	default:
		return supportv1.RuntimeCapabilityKind_RUNTIME_CAPABILITY_KIND_UNSPECIFIED
	}
}

func profileReferenceValidation(format string, args ...any) error {
	return domainerror.NewValidation("platformk8s/profileservice: "+format, args...)
}

func isDomainNotFound(err error) bool {
	var notFound *domainerror.NotFoundError
	return errors.As(err, &notFound)
}
