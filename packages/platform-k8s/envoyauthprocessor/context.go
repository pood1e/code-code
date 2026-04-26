package envoyauthprocessor

import (
	"context"
	"fmt"
	"net"
	"regexp"
	"strings"
	"sync"
	"time"

	extprocv3 "github.com/envoyproxy/go-control-plane/envoy/service/ext_proc/v3"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/types"
	ctrlclient "sigs.k8s.io/controller-runtime/pkg/client"
)

var ipv4Pattern = regexp.MustCompile(`\b(?:\d{1,3}\.){3}\d{1,3}\b`)

type authBinding struct {
	RunID              string
	SessionID          string
	CLIID              string
	VendorID           string
	ProviderID         string
	ProviderSurfaceBindingID string
	ModelID            string
	SecretNamespace    string
	SecretName         string
	SourceSecretName   string
	TargetHosts        []string
	RequestHeaderNames []string
	HeaderValuePrefix  string
	AuthAdapterID      string
	ResponseRules      []responseHeaderRule
}

type authContext struct {
	authBinding
	serialMu sync.Mutex
	mu       sync.Mutex
	Adapter  authMaterialAdapter
	Material map[string]string
}

type contextCache struct {
	mu      sync.Mutex
	ttl     time.Duration
	entries map[string]contextCacheEntry
}

type contextCacheEntry struct {
	context   *authContext
	expiresAt time.Time
}

func newContextCache(ttl time.Duration) *contextCache {
	return &contextCache{
		ttl:     ttl,
		entries: map[string]contextCacheEntry{},
	}
}

func (cache *contextCache) get(key string) (*authContext, bool) {
	if key == "" {
		return nil, false
	}
	cache.mu.Lock()
	defer cache.mu.Unlock()
	entry, ok := cache.entries[key]
	if !ok || time.Now().After(entry.expiresAt) {
		delete(cache.entries, key)
		return nil, false
	}
	return entry.context, true
}

func (cache *contextCache) set(key string, context *authContext) {
	if key == "" {
		return
	}
	cache.mu.Lock()
	defer cache.mu.Unlock()
	cache.entries[key] = contextCacheEntry{
		context:   context,
		expiresAt: time.Now().Add(cache.ttl),
	}
}

func (server *Server) resolveAuthContext(ctx context.Context, req *extprocv3.ProcessingRequest, headers requestHeaders) (*authContext, error) {
	if binding := bindingFromHeaders(headers); binding.SecretName != "" {
		return server.loadAuthContext(ctx, binding)
	}
	sourceIP := sourceIPFromRequest(req)
	if cached, ok := server.cache.get(sourceIP); ok {
		return cached, nil
	}
	binding, err := server.bindingFromPodIP(ctx, sourceIP)
	if err != nil {
		return nil, err
	}
	if binding.SecretName == "" {
		binding, err = server.bindingFromProjectedSecret(ctx, binding)
		if err != nil || binding.SecretName == "" {
			return nil, err
		}
	}
	if binding.SecretName == "" {
		server.cache.set(sourceIP, nil)
		return nil, nil
	}
	auth, err := server.loadAuthContext(ctx, binding)
	if err != nil {
		return nil, err
	}
	server.cache.set(sourceIP, auth)
	return auth, nil
}

func (server *Server) bindingFromPodIP(ctx context.Context, sourceIP string) (authBinding, error) {
	if sourceIP == "" {
		return authBinding{}, nil
	}
	var pods corev1.PodList
	if err := server.reader.List(ctx, &pods, ctrlclient.InNamespace(server.namespace)); err != nil {
		return authBinding{}, fmt.Errorf("list runtime pods: %w", err)
	}
	for index := range pods.Items {
		pod := &pods.Items[index]
		if podHasIP(pod, sourceIP) {
			return bindingFromPod(pod), nil
		}
	}
	return authBinding{}, nil
}

func (server *Server) bindingFromProjectedSecret(ctx context.Context, binding authBinding) (authBinding, error) {
	runID := strings.TrimSpace(binding.RunID)
	if runID == "" {
		return binding, nil
	}
	var secrets corev1.SecretList
	if err := server.reader.List(ctx, &secrets,
		ctrlclient.InNamespace(server.namespace),
		ctrlclient.MatchingLabels{
			ProjectedCredentialManagedByLabel: ProjectedCredentialManagedByValue,
			ProjectedCredentialRunIDLabel:     runID,
		},
	); err != nil {
		return binding, fmt.Errorf("list projected auth credentials for run %q: %w", runID, err)
	}
	if len(secrets.Items) == 0 {
		return binding, nil
	}
	if len(secrets.Items) > 1 {
		return binding, fmt.Errorf("multiple projected auth credentials for run %q", runID)
	}
	return bindingFromSecret(&secrets.Items[0], binding), nil
}

func podHasIP(pod *corev1.Pod, sourceIP string) bool {
	if pod.Status.PodIP == sourceIP {
		return true
	}
	for _, podIP := range pod.Status.PodIPs {
		if podIP.IP == sourceIP {
			return true
		}
	}
	return false
}

func (server *Server) loadAuthContext(ctx context.Context, binding authBinding) (*authContext, error) {
	if binding.SecretName == "" {
		return nil, nil
	}
	namespace := strings.TrimSpace(binding.SecretNamespace)
	if namespace == "" {
		namespace = server.namespace
	}
	binding.SecretNamespace = namespace
	if cached, ok := server.cache.get(binding.cacheKey()); ok {
		return cached, nil
	}
	var secret corev1.Secret
	key := types.NamespacedName{Namespace: namespace, Name: binding.SecretName}
	if err := server.reader.Get(ctx, key, &secret); err != nil {
		return nil, fmt.Errorf("load auth credential secret %q/%q: %w", namespace, binding.SecretName, err)
	}
	binding = bindingFromSecret(&secret, binding)
	materials, err := server.credentialMaterials(ctx, binding, secret.Data)
	if err != nil {
		return nil, err
	}
	adapter := server.adapters.resolve(binding.AuthAdapterID)
	if adapter == nil || !adapter.HasMaterial(materials) {
		return nil, fmt.Errorf("auth credential secret %q has no supported material key", binding.SecretName)
	}
	auth := &authContext{authBinding: binding, Adapter: adapter, Material: materials}
	server.cache.set(auth.cacheKey(), auth)
	return auth, nil
}

func (server *Server) credentialMaterials(ctx context.Context, binding authBinding, projectedData map[string][]byte) (map[string]string, error) {
	sourceName := strings.TrimSpace(binding.SourceSecretName)
	if sourceName == "" {
		return secretValues(projectedData), nil
	}
	namespace := strings.TrimSpace(server.controlNamespace)
	if namespace == "" {
		namespace = server.namespace
	}
	var source corev1.Secret
	if err := server.reader.Get(ctx, types.NamespacedName{Namespace: namespace, Name: sourceName}, &source); err != nil {
		return nil, fmt.Errorf("load source auth credential secret %q/%q: %w", namespace, sourceName, err)
	}
	return secretValues(source.Data), nil
}

func (binding authBinding) cacheKey() string {
	namespace := strings.TrimSpace(binding.SecretNamespace)
	name := strings.TrimSpace(binding.SecretName)
	if name == "" {
		return ""
	}
	return "credential:" + namespace + "/" + name
}

func (auth *authContext) cacheKey() string {
	if auth == nil {
		return ""
	}
	return auth.authBinding.cacheKey()
}

func secretValues(data map[string][]byte) map[string]string {
	if len(data) == 0 {
		return nil
	}
	values := make(map[string]string, len(data))
	for key, value := range data {
		key = strings.TrimSpace(key)
		if key == "" {
			continue
		}
		if value := strings.TrimSpace(string(value)); value != "" {
			values[key] = value
		}
	}
	if len(values) == 0 {
		return nil
	}
	return values
}

func sourceIPFromRequest(req *extprocv3.ProcessingRequest) string {
	if req == nil {
		return ""
	}
	for key, value := range req.GetAttributes() {
		if ip := firstIPv4(key + " " + fmt.Sprint(value)); ip != "" {
			return ip
		}
	}
	return ""
}

func firstIPv4(value string) string {
	for _, candidate := range ipv4Pattern.FindAllString(value, -1) {
		ip := net.ParseIP(candidate)
		if ip != nil && ip.To4() != nil {
			return candidate
		}
	}
	return ""
}
