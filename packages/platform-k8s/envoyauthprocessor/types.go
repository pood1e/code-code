package envoyauthprocessor

import (
	"errors"
	"log/slog"
	"time"

	"code-code.internal/platform-k8s/egressauth"
	extprocv3 "github.com/envoyproxy/go-control-plane/envoy/service/ext_proc/v3"
	ctrlclient "sigs.k8s.io/controller-runtime/pkg/client"
)

const (
	DefaultNamespace     = "code-code-runs"
	DefaultCacheTTL      = 30 * time.Second
	DefaultLookupTimeout = 2 * time.Second

	HeaderRunID                     = egressauth.HeaderRunID
	HeaderSessionID                 = egressauth.HeaderSessionID
	HeaderCLIID                     = egressauth.HeaderCLIID
	HeaderVendorID                  = egressauth.HeaderVendorID
	HeaderProviderID                = egressauth.HeaderProviderID
	HeaderProviderSurfaceBindingID        = egressauth.HeaderProviderSurfaceBindingID
	HeaderModelID                   = egressauth.HeaderModelID
	HeaderCredentialSecretNamespace = egressauth.HeaderCredentialSecretNamespace
	HeaderCredentialSecretName      = egressauth.HeaderCredentialSecretName
	HeaderTargetHosts               = egressauth.HeaderTargetHosts
	HeaderRequestHeaderNames        = egressauth.HeaderRequestHeaderNames
	HeaderHeaderValuePrefix         = egressauth.HeaderHeaderValuePrefix
	HeaderAuthAdapterID             = egressauth.HeaderAuthAdapterID
	HeaderResponseHeaderRulesJSON   = egressauth.HeaderResponseHeaderRulesJSON

	AnnotationRunID                     = egressauth.AnnotationRunID
	AnnotationSessionID                 = egressauth.AnnotationSessionID
	AnnotationCLIID                     = egressauth.AnnotationCLIID
	AnnotationVendorID                  = egressauth.AnnotationVendorID
	AnnotationProviderID                = egressauth.AnnotationProviderID
	AnnotationCredentialSecretNamespace = egressauth.AnnotationCredentialSecretNamespace
	AnnotationProviderSurfaceBindingID        = egressauth.AnnotationProviderSurfaceBindingID
	AnnotationModelID                   = egressauth.AnnotationModelID
	AnnotationCredentialSecretName      = egressauth.AnnotationCredentialSecretName
	AnnotationTargetHosts               = egressauth.AnnotationTargetHosts
	AnnotationRequestHeaderNames        = egressauth.AnnotationRequestHeaderNames
	AnnotationHeaderValuePrefix         = egressauth.AnnotationHeaderValuePrefix
	AnnotationAuthAdapterID             = egressauth.AnnotationAuthAdapterID
	AnnotationResponseHeaderRulesJSON   = egressauth.AnnotationResponseHeaderRulesJSON
	AnnotationRuntimeURL                = egressauth.AnnotationRuntimeURL
	AnnotationAuthMaterializationKey    = egressauth.AnnotationAuthMaterializationKey

	ProjectedCredentialManagedByLabel   = egressauth.ProjectedCredentialManagedByLabel
	ProjectedCredentialManagedByValue   = egressauth.ProjectedCredentialManagedByValue
	ProjectedCredentialRunNameLabel     = egressauth.ProjectedCredentialRunNameLabel
	ProjectedCredentialRunIDLabel       = egressauth.ProjectedCredentialRunIDLabel
	ProjectedCredentialSessionIDLabel   = egressauth.ProjectedCredentialSessionIDLabel
	ProjectedCredentialSourceAnnotation = egressauth.ProjectedCredentialSourceAnnotation

	Placeholder = egressauth.Placeholder
)

var internalHeaders = egressauth.InternalHeaders()

// Options wires the Envoy external processor to runtime auth state.
type Options struct {
	Namespace        string
	ControlNamespace string
	Reader           ctrlclient.Reader
	CacheTTL         time.Duration
	LookupTimeout    time.Duration
	Logger           *slog.Logger
}

// Server implements Envoy's ext_proc service for auth header replacement.
type Server struct {
	extprocv3.UnimplementedExternalProcessorServer

	namespace        string
	controlNamespace string
	reader           ctrlclient.Reader
	cacheTTL         time.Duration
	lookupTimeout    time.Duration
	logger           *slog.Logger
	cache            *contextCache
	metrics          *responseMetrics
	adapters         authMaterialAdapters
}

// NewServer creates an Envoy auth header processor.
func NewServer(options Options) (*Server, error) {
	if options.Reader == nil {
		return nil, errors.New("kubernetes reader is required")
	}
	namespace := options.Namespace
	if namespace == "" {
		namespace = DefaultNamespace
	}
	controlNamespace := options.ControlNamespace
	if controlNamespace == "" {
		controlNamespace = namespace
	}
	cacheTTL := options.CacheTTL
	if cacheTTL <= 0 {
		cacheTTL = DefaultCacheTTL
	}
	lookupTimeout := options.LookupTimeout
	if lookupTimeout <= 0 {
		lookupTimeout = DefaultLookupTimeout
	}
	logger := options.Logger
	if logger == nil {
		logger = slog.Default()
	}
	metrics, err := defaultResponseMetrics()
	if err != nil {
		return nil, err
	}
	return &Server{
		namespace:        namespace,
		controlNamespace: controlNamespace,
		reader:           options.Reader,
		cacheTTL:         cacheTTL,
		lookupTimeout:    lookupTimeout,
		logger:           logger,
		cache:            newContextCache(cacheTTL),
		metrics:          metrics,
		adapters:         defaultAuthMaterialAdapters(),
	}, nil
}
