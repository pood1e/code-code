package providerv1

import (
	"strings"

	apiprotocolv1 "code-code.internal/go-contract/api_protocol/v1"
)

// RuntimeKind returns the surface kind implied by runtime access.
func RuntimeKind(runtime *ProviderSurfaceRuntime) ProviderSurfaceKind {
	if runtime == nil {
		return ProviderSurfaceKind_PROVIDER_SURFACE_KIND_UNSPECIFIED
	}
	if runtime.GetApi() != nil {
		return ProviderSurfaceKind_PROVIDER_SURFACE_KIND_API
	}
	if runtime.GetCli() != nil {
		return ProviderSurfaceKind_PROVIDER_SURFACE_KIND_CLI
	}
	return ProviderSurfaceKind_PROVIDER_SURFACE_KIND_UNSPECIFIED
}

// RuntimeProtocol returns the API protocol declared by runtime access.
func RuntimeProtocol(runtime *ProviderSurfaceRuntime) apiprotocolv1.Protocol {
	if runtime == nil || runtime.GetApi() == nil {
		return apiprotocolv1.Protocol_PROTOCOL_UNSPECIFIED
	}
	return runtime.GetApi().GetProtocol()
}

// RuntimeBaseURL returns the API base URL declared by runtime access.
func RuntimeBaseURL(runtime *ProviderSurfaceRuntime) string {
	if runtime == nil || runtime.GetApi() == nil {
		return ""
	}
	return strings.TrimSpace(runtime.GetApi().GetBaseUrl())
}

// RuntimeCLIID returns the CLI id declared by runtime access.
func RuntimeCLIID(runtime *ProviderSurfaceRuntime) string {
	if runtime == nil || runtime.GetCli() == nil {
		return ""
	}
	return strings.TrimSpace(runtime.GetCli().GetCliId())
}
