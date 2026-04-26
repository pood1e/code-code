package egressauth

const (
	HeaderRunID                     = "x-code-code-run-id"
	HeaderSessionID                 = "x-code-code-session-id"
	HeaderCLIID                     = "x-code-code-cli-id"
	HeaderVendorID                  = "x-code-code-vendor-id"
	HeaderProviderID                = "x-code-code-provider-id"
	HeaderProviderSurfaceBindingID        = "x-code-code-provider-account-surface-id"
	HeaderModelID                   = "x-code-code-model-id"
	HeaderCredentialID              = "x-code-code-credential-id"
	HeaderCredentialSecretNamespace = "x-code-code-credential-secret-namespace"
	HeaderCredentialSecretName      = "x-code-code-credential-secret-name"
	HeaderTargetHosts               = "x-code-code-target-hosts"
	HeaderRequestHeaderNames        = "x-code-code-request-header-names"
	HeaderHeaderValuePrefix         = "x-code-code-header-value-prefix"
	HeaderAuthAdapterID             = "x-code-code-auth-adapter-id"
	HeaderRequestHeaderRulesJSON    = "x-code-code-request-header-rules-json"
	HeaderResponseHeaderRulesJSON   = "x-code-code-response-header-rules-json"

	AnnotationRunID                     = "auth.code-code.internal/run-id"
	AnnotationSessionID                 = "auth.code-code.internal/session-id"
	AnnotationCLIID                     = "auth.code-code.internal/cli-id"
	AnnotationVendorID                  = "auth.code-code.internal/vendor-id"
	AnnotationProviderID                = "auth.code-code.internal/provider-id"
	AnnotationProviderSurfaceBindingID        = "auth.code-code.internal/provider-account-surface-id"
	AnnotationModelID                   = "auth.code-code.internal/model-id"
	AnnotationCredentialSecretNamespace = "auth.code-code.internal/credential-secret-namespace"
	AnnotationCredentialSecretName      = "auth.code-code.internal/credential-secret-name"
	AnnotationTargetHosts               = "auth.code-code.internal/target-hosts"
	AnnotationTargetPathPrefixes        = "auth.code-code.internal/target-path-prefixes"
	AnnotationRequestHeaderNames        = "auth.code-code.internal/request-header-names"
	AnnotationHeaderValuePrefix         = "auth.code-code.internal/header-value-prefix"
	AnnotationAuthAdapterID             = "auth.code-code.internal/auth-adapter-id"
	AnnotationRequestHeaderRulesJSON    = "auth.code-code.internal/request-header-rules-json"
	AnnotationResponseHeaderRulesJSON   = "auth.code-code.internal/response-header-rules-json"
	AnnotationResponseHeaderMetricsJSON = "auth.code-code.internal/response-header-metrics-json"
	AnnotationRuntimeURL                = "auth.code-code.internal/runtime-url"
	AnnotationAuthMaterializationKey    = "auth.code-code.internal/auth-materialization-key"
	AnnotationEgressPolicyID            = "auth.code-code.internal/egress-policy-id"
	AnnotationAuthPolicyID              = "auth.code-code.internal/auth-policy-id"
	AnnotationHeaderMetricPolicyID      = "auth.code-code.internal/header-metric-policy-id"

	ProjectedCredentialManagedByLabel   = "app.kubernetes.io/managed-by"
	ProjectedCredentialManagedByValue   = "platform-agent-runtime-service"
	ProjectedCredentialRunNameLabel     = "agentrun.code-code.internal/resource-name"
	ProjectedCredentialRunIDLabel       = "agentrun.code-code.internal/run-id"
	ProjectedCredentialSessionIDLabel   = "agentrun.code-code.internal/session-id"
	ProjectedCredentialSourceAnnotation = "agentrun.code-code.internal/source-secret-name"

	Placeholder = "PLACEHOLDER"

	AuthAdapterDefaultID               = "default"
	AuthAdapterSessionCookieID         = "session-cookie"
	AuthAdapterGoogleAIStudioSessionID = "google-aistudio-session"
)

func InternalHeaders() []string {
	return []string{
		HeaderRunID,
		HeaderSessionID,
		HeaderCLIID,
		HeaderVendorID,
		HeaderProviderID,
		HeaderProviderSurfaceBindingID,
		HeaderModelID,
		HeaderCredentialID,
		HeaderCredentialSecretNamespace,
		HeaderCredentialSecretName,
		HeaderTargetHosts,
		HeaderRequestHeaderNames,
		HeaderHeaderValuePrefix,
		HeaderAuthAdapterID,
		HeaderRequestHeaderRulesJSON,
		HeaderResponseHeaderRulesJSON,
	}
}
