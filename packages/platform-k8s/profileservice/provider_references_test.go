package profileservice

import (
	"context"
	"strings"
	"testing"

	cliruntimev1 "code-code.internal/go-contract/platform/cli_runtime/v1"
	providerservicev1 "code-code.internal/go-contract/platform/provider/v1"
	supportv1 "code-code.internal/go-contract/platform/support/v1"
	"google.golang.org/grpc"
)

func TestProviderReferenceExecutionClassRequiresLatestImage(t *testing.T) {
	references := newProviderReferenceClient(
		profileReferenceProviderClient{
			definitions: []*providerservicev1.CLIDefinitionView{{
				CliId: "codex",
				ContainerImages: []*providerservicev1.CLIContainerImageView{{
					ExecutionClass: "cli-standard",
				}},
			}},
		},
		profileReferenceCLIClient{
			images: []*cliruntimev1.CLIRuntimeImage{{
				CliId:          "codex",
				ExecutionClass: "cli-standard",
				Image:          "code-code/codex:cli-1.2.3",
			}},
		},
		profileReferenceSupportClient{},
	)

	if err := references.ExecutionClassExists(context.Background(), "codex", "cli-standard"); err != nil {
		t.Fatalf("ExecutionClassExists() error = %v", err)
	}
}

func TestProviderReferenceRejectsUnavailableExecutionClassImage(t *testing.T) {
	references := newProviderReferenceClient(
		profileReferenceProviderClient{
			definitions: []*providerservicev1.CLIDefinitionView{{
				CliId: "codex",
				ContainerImages: []*providerservicev1.CLIContainerImageView{{
					ExecutionClass: "cli-standard",
				}},
			}},
		},
		profileReferenceCLIClient{},
		profileReferenceSupportClient{},
	)

	err := references.ExecutionClassExists(context.Background(), "codex", "cli-standard")
	if err == nil || !strings.Contains(err.Error(), "no available runtime image") {
		t.Fatalf("ExecutionClassExists() error = %v, want no available runtime image", err)
	}
}

type profileReferenceProviderClient struct {
	providerservicev1.ProviderServiceClient
	definitions []*providerservicev1.CLIDefinitionView
}

func (c profileReferenceProviderClient) ListCLIDefinitions(context.Context, *providerservicev1.ListCLIDefinitionsRequest, ...grpc.CallOption) (*providerservicev1.ListCLIDefinitionsResponse, error) {
	return &providerservicev1.ListCLIDefinitionsResponse{Items: c.definitions}, nil
}

type profileReferenceCLIClient struct {
	cliruntimev1.CLIRuntimeServiceClient
	images []*cliruntimev1.CLIRuntimeImage
}

func (c profileReferenceCLIClient) GetLatestAvailableCLIRuntimeImages(context.Context, *cliruntimev1.GetLatestAvailableCLIRuntimeImagesRequest, ...grpc.CallOption) (*cliruntimev1.GetLatestAvailableCLIRuntimeImagesResponse, error) {
	return &cliruntimev1.GetLatestAvailableCLIRuntimeImagesResponse{Items: c.images}, nil
}

type profileReferenceSupportClient struct {
	supportv1.SupportServiceClient
}
