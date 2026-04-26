package envoyauthprocessor

import (
	"context"
	"fmt"
	"math"
	"regexp"
	"slices"
	"strings"
	"sync"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	otelmetric "go.opentelemetry.io/otel/metric"
)

const (
	cliRuntimeContext    = "cli_runtime"
	vendorRuntimeContext = "vendor_runtime"

	runtimeRequestsMetric  = "gen_ai.provider.runtime.requests.total"
	runtimeRateLimitMetric = "gen_ai.provider.runtime.rate_limit.events.total"
	runtimeLastSeenMetric  = "gen_ai.provider.runtime.last_seen.timestamp.seconds"
)

var durationPartPattern = regexp.MustCompile(`([+-]?(?:\d+(?:\.\d+)?|\.\d+))(ns|us|µs|ms|s|m|h)`)

type responseHeaderRule struct {
	HeaderName string            `json:"header_name"`
	MetricName string            `json:"metric_name"`
	ValueType  string            `json:"value_type"`
	Context    string            `json:"context"`
	Labels     map[string]string `json:"labels,omitempty"`
}

type responseMetrics struct {
	meter      otelmetric.Meter
	requests   otelmetric.Int64Counter
	rateLimits otelmetric.Int64Counter
	lastSeen   otelmetric.Float64Gauge

	mu           sync.Mutex
	headerGauges map[string]responseHeaderGauge
}

type responseHeaderGauge struct {
	gauge      otelmetric.Float64Gauge
	labelNames []string
}

func defaultResponseMetrics() (*responseMetrics, error) {
	return newResponseMetrics(otel.Meter("platform-k8s/egress-auth-processor"))
}

func newResponseMetrics(meter otelmetric.Meter) (*responseMetrics, error) {
	if meter == nil {
		meter = otel.Meter("platform-k8s/egress-auth-processor")
	}
	requests, err := meter.Int64Counter(
		runtimeRequestsMetric,
		otelmetric.WithDescription("Matched provider runtime requests observed by Envoy egress."),
		otelmetric.WithUnit("1"),
	)
	if err != nil {
		return nil, fmt.Errorf("envoyauthprocessor: create requests metric: %w", err)
	}
	rateLimits, err := meter.Int64Counter(
		runtimeRateLimitMetric,
		otelmetric.WithDescription("Provider runtime rate limit events observed by Envoy egress."),
		otelmetric.WithUnit("1"),
	)
	if err != nil {
		return nil, fmt.Errorf("envoyauthprocessor: create rate limit metric: %w", err)
	}
	lastSeen, err := meter.Float64Gauge(
		runtimeLastSeenMetric,
		otelmetric.WithDescription("Unix timestamp of the most recent matched provider runtime response observed by Envoy egress."),
	)
	if err != nil {
		return nil, fmt.Errorf("envoyauthprocessor: create last seen metric: %w", err)
	}
	return &responseMetrics{
		meter:        meter,
		requests:     requests,
		rateLimits:   rateLimits,
		lastSeen:     lastSeen,
		headerGauges: map[string]responseHeaderGauge{},
	}, nil
}

func (metrics *responseMetrics) recordResponse(headers requestHeaders, auth *authContext, authority string) {
	if metrics == nil || auth == nil || !auth.matchesTargetHost(authority) {
		return
	}
	host := normalizeHost(authority)
	status := headers.statusCode()
	ctx := context.Background()
	if auth.CLIID != "" {
		commonAttrs := []attribute.KeyValue{
			attribute.String("cli_id", auth.CLIID),
			attribute.String("provider_id", auth.ProviderID),
			attribute.String("provider_surface_binding_id", auth.ProviderSurfaceBindingID),
			attribute.String("host", host),
			attribute.String("model_id", auth.ModelID),
		}
		metrics.requests.Add(ctx, 1, otelmetric.WithAttributes(append(commonAttrs, attribute.String("status_class", statusClass(status)))...))
		metrics.lastSeen.Record(ctx, float64(time.Now().Unix()), otelmetric.WithAttributes(commonAttrs...))
		if status == 429 {
			metrics.rateLimits.Add(ctx, 1, otelmetric.WithAttributes(append(commonAttrs, attribute.String("limit_kind", "unknown"))...))
		}
	}
	for _, rule := range auth.ResponseRules {
		value := headers.get(rule.HeaderName)
		if value == "" || rule.MetricName == "" {
			continue
		}
		parsed, ok := parseHeaderMetricValue(value, rule.ValueType)
		if !ok || math.IsNaN(parsed) || math.IsInf(parsed, 0) {
			continue
		}
		gauge, attrs := metrics.headerGauge(rule, auth, host)
		if gauge == nil {
			continue
		}
		gauge.Record(ctx, parsed, otelmetric.WithAttributes(attrs...))
	}
}

func (metrics *responseMetrics) headerGauge(rule responseHeaderRule, auth *authContext, host string) (otelmetric.Float64Gauge, []attribute.KeyValue) {
	metricName := strings.TrimSpace(rule.MetricName)
	if metricName == "" {
		return nil, nil
	}
	labelValues := responseMetricLabels(rule, auth, host)
	labelNames := sortedLabelNames(labelValues)
	metrics.mu.Lock()
	defer metrics.mu.Unlock()
	gauge := metrics.headerGauges[metricName]
	if gauge.gauge == nil {
		created, err := metrics.meter.Float64Gauge(
			metricName,
			otelmetric.WithDescription(fmt.Sprintf("Parsed response header value exported by Envoy egress for %s.", metricName)),
		)
		if err != nil {
			return nil, nil
		}
		gauge = responseHeaderGauge{gauge: created, labelNames: labelNames}
		metrics.headerGauges[metricName] = gauge
	}
	if !slices.Equal(gauge.labelNames, labelNames) {
		return nil, nil
	}
	return gauge.gauge, responseMetricAttributes(labelValues, labelNames)
}

func responseMetricLabels(rule responseHeaderRule, auth *authContext, host string) map[string]string {
	labels := map[string]string{}
	if rule.Context == vendorRuntimeContext {
		labels["vendor_id"] = auth.VendorID
		labels["provider_id"] = auth.ProviderID
		labels["provider_surface_binding_id"] = auth.ProviderSurfaceBindingID
	} else {
		labels["cli_id"] = auth.CLIID
		labels["provider_id"] = auth.ProviderID
		labels["provider_surface_binding_id"] = auth.ProviderSurfaceBindingID
		labels["host"] = host
		labels["model_id"] = auth.ModelID
	}
	for key, value := range rule.Labels {
		key = strings.TrimSpace(key)
		value = strings.TrimSpace(value)
		if key != "" && value != "" {
			labels[key] = value
		}
	}
	return labels
}

func sortedLabelNames(labels map[string]string) []string {
	names := make([]string, 0, len(labels))
	for name := range labels {
		names = append(names, name)
	}
	slices.Sort(names)
	return names
}

func responseMetricAttributes(labels map[string]string, labelNames []string) []attribute.KeyValue {
	attrs := make([]attribute.KeyValue, 0, len(labelNames))
	for _, name := range labelNames {
		attrs = append(attrs, attribute.String(name, labels[name]))
	}
	return attrs
}
