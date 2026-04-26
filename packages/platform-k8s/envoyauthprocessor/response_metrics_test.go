package envoyauthprocessor

import (
	"context"
	"testing"

	corev3 "github.com/envoyproxy/go-control-plane/envoy/config/core/v3"
	sdkmetric "go.opentelemetry.io/otel/sdk/metric"
	"go.opentelemetry.io/otel/sdk/metric/metricdata"
)

func TestResponseMetricsRecordsConfiguredHeaderMetric(t *testing.T) {
	reader := sdkmetric.NewManualReader()
	provider := sdkmetric.NewMeterProvider(sdkmetric.WithReader(reader))
	t.Cleanup(func() { _ = provider.Shutdown(context.Background()) })
	metrics, err := newResponseMetrics(provider.Meter("egress-auth-processor-test"))
	if err != nil {
		t.Fatalf("newResponseMetrics() error = %v", err)
	}
	headers := newRequestHeaders([]*corev3.HeaderValue{
		{Key: ":status", RawValue: []byte("200")},
		{Key: "x-ratelimit-remaining", RawValue: []byte("7")},
	})
	auth := &authContext{authBinding: authBinding{
		CLIID:              "codex",
		ProviderID:         "codex",
		ProviderSurfaceBindingID: "openrouter-default",
		ModelID:            "gpt-5.4",
		TargetHosts:        []string{"api.openai.com"},
		ResponseRules: []responseHeaderRule{{
			HeaderName: "x-ratelimit-remaining",
			MetricName: "gen_ai.provider.runtime.rate_limit.remaining",
			ValueType:  "int64",
			Context:    cliRuntimeContext,
		}},
	}}

	metrics.recordResponse(headers, auth, "api.openai.com")

	if got := metricValue(t, reader, "gen_ai.provider.runtime.rate_limit.remaining"); got != 7 {
		t.Fatalf("header metric = %v, want 7", got)
	}
	if got := metricValue(t, reader, runtimeRequestsMetric); got != 1 {
		t.Fatalf("request count = %v, want 1", got)
	}
}

func TestParseHeaderMetricValueSupportsDuration(t *testing.T) {
	got, ok := parseHeaderMetricValue("1h2m3.5s", "duration_seconds")
	if !ok {
		t.Fatal("duration was not parsed")
	}
	if got != 3723.5 {
		t.Fatalf("duration = %v, want 3723.5", got)
	}
}

func metricValue(t *testing.T, reader *sdkmetric.ManualReader, name string) float64 {
	t.Helper()
	var resourceMetrics metricdata.ResourceMetrics
	if err := reader.Collect(context.Background(), &resourceMetrics); err != nil {
		t.Fatalf("collect metrics: %v", err)
	}
	for _, scopeMetrics := range resourceMetrics.ScopeMetrics {
		for _, observed := range scopeMetrics.Metrics {
			if observed.Name != name {
				continue
			}
			return firstMetricValue(t, name, observed.Data)
		}
	}
	t.Fatalf("metric %q not found", name)
	return 0
}

func firstMetricValue(t *testing.T, name string, data metricdata.Aggregation) float64 {
	t.Helper()
	switch value := data.(type) {
	case metricdata.Gauge[float64]:
		if len(value.DataPoints) > 0 {
			return value.DataPoints[0].Value
		}
	case metricdata.Sum[int64]:
		if len(value.DataPoints) > 0 {
			return float64(value.DataPoints[0].Value)
		}
	case metricdata.Sum[float64]:
		if len(value.DataPoints) > 0 {
			return value.DataPoints[0].Value
		}
	}
	t.Fatalf("metric %q data = %T, want gauge or sum with one point", name, data)
	return 0
}
