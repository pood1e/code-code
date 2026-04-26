package sessionapi

import (
	"context"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"code-code.internal/go-contract/domainerror"
	observabilityv1 "code-code.internal/go-contract/observability/v1"
	agentrunv1 "code-code.internal/go-contract/platform/agent_run/v1"
	managementv1 "code-code.internal/go-contract/platform/management/v1"
	"code-code.internal/platform-k8s/telemetry"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	otelmetric "go.opentelemetry.io/otel/metric"
)

func (s *SessionServer) RecordAgentRunResponseHeaders(ctx context.Context, request *managementv1.RecordAgentRunResponseHeadersRequest) (*managementv1.RecordAgentRunResponseHeadersResponse, error) {
	if request == nil {
		return nil, grpcError(domainerror.NewValidation("platformk8s/sessionapi: response header record request is required"))
	}
	contextRequest, err := runtimeContextRequestFromResponseHeaders(request)
	if err != nil {
		return nil, grpcError(err)
	}
	contextResponse, err := s.ResolveAgentRunRuntimeContext(ctx, contextRequest)
	if err != nil {
		return nil, err
	}
	metadata := contextResponse.GetMetadata()
	if metadata == nil || !matchesRuntimeResponseHeaderTarget(request.GetTargetHost(), request.GetTargetPath(), metadata) {
		return &managementv1.RecordAgentRunResponseHeadersResponse{Skipped: true}, nil
	}
	rules := metadata.GetResponseHeaderMetricRules()
	if len(rules) == 0 {
		return &managementv1.RecordAgentRunResponseHeadersResponse{Skipped: true}, nil
	}
	headers := normalizedResponseHeaders(request.GetResponseHeaders())
	recorder := defaultResponseHeaderMetrics()
	recorded := false
	for _, rule := range rules {
		value := strings.TrimSpace(headers[normalizeResponseHeaderName(rule.GetHeaderName())])
		if value == "" {
			continue
		}
		metricValue, ok := parseResponseHeaderMetricValue(value, rule.GetValueType())
		if !ok {
			continue
		}
		recorder.record(rule.GetMetricName(), metricValue, responseHeaderMetricAttributes(contextResponse.GetRun(), metadata, rule))
		recorded = true
	}
	if !recorded {
		return &managementv1.RecordAgentRunResponseHeadersResponse{Skipped: true}, nil
	}
	return &managementv1.RecordAgentRunResponseHeadersResponse{Recorded: true}, nil
}

func runtimeContextRequestFromResponseHeaders(request *managementv1.RecordAgentRunResponseHeadersRequest) (*managementv1.ResolveAgentRunRuntimeContextRequest, error) {
	switch source := request.GetSource().(type) {
	case *managementv1.RecordAgentRunResponseHeadersRequest_RunId:
		runID := strings.TrimSpace(source.RunId)
		if runID == "" {
			return nil, domainerror.NewValidation("platformk8s/sessionapi: run_id is required")
		}
		return &managementv1.ResolveAgentRunRuntimeContextRequest{
			Source: &managementv1.ResolveAgentRunRuntimeContextRequest_RunId{RunId: runID},
		}, nil
	case *managementv1.RecordAgentRunResponseHeadersRequest_WorkloadId:
		workloadID := strings.TrimSpace(source.WorkloadId)
		if workloadID == "" {
			return nil, domainerror.NewValidation("platformk8s/sessionapi: workload_id is required")
		}
		return &managementv1.ResolveAgentRunRuntimeContextRequest{
			Source: &managementv1.ResolveAgentRunRuntimeContextRequest_WorkloadId{WorkloadId: workloadID},
		}, nil
	case *managementv1.RecordAgentRunResponseHeadersRequest_Pod:
		return &managementv1.ResolveAgentRunRuntimeContextRequest{
			Source: &managementv1.ResolveAgentRunRuntimeContextRequest_Pod{Pod: source.Pod},
		}, nil
	default:
		return nil, domainerror.NewValidation("platformk8s/sessionapi: runtime source is required")
	}
}

func matchesRuntimeResponseHeaderTarget(targetHost string, targetPath string, metadata *managementv1.AgentRunRuntimeMetadata) bool {
	hosts := normalizedRuntimeHosts(metadata.GetTargetHosts())
	if len(hosts) == 0 || !matchesRuntimeHost(targetHost, hosts) {
		return false
	}
	paths := normalizedRuntimePathPrefixes(metadata.GetTargetPathPrefixes())
	return len(paths) == 0 || matchesRuntimePath(targetPath, paths)
}

func normalizedRuntimeHosts(values []string) []string {
	seen := map[string]struct{}{}
	out := make([]string, 0, len(values))
	for _, value := range values {
		host := normalizeRuntimeHost(value)
		if host == "" {
			continue
		}
		if _, ok := seen[host]; ok {
			continue
		}
		seen[host] = struct{}{}
		out = append(out, host)
	}
	return out
}

func matchesRuntimeHost(value string, allowed []string) bool {
	host := normalizeRuntimeHost(value)
	if host == "" {
		return false
	}
	for _, candidate := range allowed {
		if host == normalizeRuntimeHost(candidate) {
			return true
		}
	}
	return false
}

func normalizeRuntimeHost(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	value = strings.TrimPrefix(value, "https://")
	value = strings.TrimPrefix(value, "http://")
	value = strings.TrimSuffix(value, ".")
	if strings.HasPrefix(value, "[") {
		if index := strings.Index(value, "]"); index > 0 {
			return value[1:index]
		}
	}
	if index := strings.LastIndex(value, ":"); index > 0 && !strings.Contains(value[:index], ":") {
		value = value[:index]
	}
	return strings.Trim(value, "[]")
}

func normalizedRuntimePathPrefixes(values []string) []string {
	seen := map[string]struct{}{}
	out := make([]string, 0, len(values))
	for _, value := range values {
		prefix := normalizeRuntimePath(value)
		if prefix == "" {
			continue
		}
		if prefix != "/" {
			prefix = strings.TrimRight(prefix, "/")
		}
		if _, ok := seen[prefix]; ok {
			continue
		}
		seen[prefix] = struct{}{}
		out = append(out, prefix)
	}
	return out
}

func matchesRuntimePath(value string, prefixes []string) bool {
	path := normalizeRuntimePath(value)
	if path == "" {
		return false
	}
	for _, prefix := range prefixes {
		prefix = normalizeRuntimePath(prefix)
		if prefix == "/" || path == prefix || strings.HasPrefix(path, strings.TrimRight(prefix, "/")+"/") {
			return true
		}
	}
	return false
}

func normalizeRuntimePath(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return ""
	}
	if index := strings.IndexAny(value, "?#"); index >= 0 {
		value = value[:index]
	}
	if !strings.HasPrefix(value, "/") {
		value = "/" + value
	}
	return value
}

func normalizedResponseHeaders(headers map[string]string) map[string]string {
	out := make(map[string]string, len(headers))
	for name, value := range headers {
		name = normalizeResponseHeaderName(name)
		value = strings.TrimSpace(value)
		if name != "" && value != "" {
			out[name] = value
		}
	}
	return out
}

func normalizeResponseHeaderName(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}

func parseResponseHeaderMetricValue(value string, valueType observabilityv1.HeaderValueType) (float64, bool) {
	value = strings.TrimSpace(value)
	if value == "" {
		return 0, false
	}
	switch valueType {
	case observabilityv1.HeaderValueType_HEADER_VALUE_TYPE_INT64,
		observabilityv1.HeaderValueType_HEADER_VALUE_TYPE_DOUBLE,
		observabilityv1.HeaderValueType_HEADER_VALUE_TYPE_DURATION_SECONDS,
		observabilityv1.HeaderValueType_HEADER_VALUE_TYPE_UNIX_SECONDS,
		observabilityv1.HeaderValueType_HEADER_VALUE_TYPE_UNSPECIFIED:
		parsed, err := strconv.ParseFloat(value, 64)
		return parsed, err == nil
	case observabilityv1.HeaderValueType_HEADER_VALUE_TYPE_RFC3339_TIMESTAMP:
		parsed, err := time.Parse(time.RFC3339, value)
		if err != nil {
			return 0, false
		}
		return float64(parsed.Unix()), true
	default:
		return 0, false
	}
}

func responseHeaderMetricAttributes(run *agentrunv1.AgentRunState, metadata *managementv1.AgentRunRuntimeMetadata, rule *agentrunv1.AgentRunResponseHeaderRule) []attribute.KeyValue {
	runID := ""
	if run != nil && run.GetSpec() != nil {
		runID = strings.TrimSpace(run.GetSpec().GetRunId())
	}
	attrs := []attribute.KeyValue{
		attribute.String("provider_id", strings.TrimSpace(metadata.GetProviderId())),
		attribute.String("cli_id", strings.TrimSpace(metadata.GetCliId())),
		attribute.String("model_id", strings.TrimSpace(metadata.GetModelId())),
		attribute.String("protocol", strings.ToLower(strings.TrimPrefix(metadata.GetProtocol().String(), "PROTOCOL_"))),
		attribute.String("run_id", runID),
	}
	for _, label := range rule.GetLabels() {
		name := telemetry.StorageMetricName(strings.TrimSpace(label.GetName()))
		value := strings.TrimSpace(label.GetValue())
		if name != "" && value != "" {
			attrs = append(attrs, attribute.String(name, value))
		}
	}
	return attrs
}

type agentRunResponseHeaderMetrics struct {
	meter  otelmetric.Meter
	mu     sync.Mutex
	gauges map[string]otelmetric.Float64Gauge
}

var (
	defaultResponseHeaderMetricsOnce sync.Once
	defaultResponseHeaderMetricsInst *agentRunResponseHeaderMetrics
)

func defaultResponseHeaderMetrics() *agentRunResponseHeaderMetrics {
	defaultResponseHeaderMetricsOnce.Do(func() {
		defaultResponseHeaderMetricsInst = &agentRunResponseHeaderMetrics{
			meter:  otel.Meter("platform-k8s/sessionapi"),
			gauges: map[string]otelmetric.Float64Gauge{},
		}
	})
	return defaultResponseHeaderMetricsInst
}

func (m *agentRunResponseHeaderMetrics) record(metricName string, value float64, attrs []attribute.KeyValue) {
	if m == nil {
		return
	}
	gauge, err := m.gauge(metricName)
	if err != nil || gauge == nil {
		return
	}
	gauge.Record(context.Background(), value, otelmetric.WithAttributes(attrs...))
}

func (m *agentRunResponseHeaderMetrics) gauge(metricName string) (otelmetric.Float64Gauge, error) {
	metricName = strings.TrimSpace(metricName)
	if !responseHeaderMetricNamePattern.MatchString(metricName) {
		return nil, fmt.Errorf("platformk8s/sessionapi: invalid response header metric name %q", metricName)
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	if gauge, ok := m.gauges[metricName]; ok {
		return gauge, nil
	}
	gauge, err := m.meter.Float64Gauge(metricName, otelmetric.WithDescription("AgentRun response-header business metric."))
	if err != nil {
		return nil, err
	}
	m.gauges[metricName] = gauge
	return gauge, nil
}

var responseHeaderMetricNamePattern = regexp.MustCompile(`^[a-zA-Z][a-zA-Z0-9_.\-/]{0,254}$`)
