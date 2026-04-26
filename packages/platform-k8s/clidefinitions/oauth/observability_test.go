package oauth

import (
	"testing"

	supportv1 "code-code.internal/go-contract/platform/support/v1"
	observabilityv1 "code-code.internal/go-contract/observability/v1"
)

func TestResolveOAuthResponseHeaderRules(t *testing.T) {
	pkg := &supportv1.CLI{
		CliId: "codex",
		Oauth: &supportv1.OAuthSupport{
			Observability: &observabilityv1.ObservabilityCapability{
				Profiles: []*observabilityv1.ObservabilityProfile{{
					ProfileId:   "oauth_runtime_openai_headers",
					DisplayName: "OpenAI Runtime Headers",
					Metrics: []*observabilityv1.ObservabilityMetric{
						{
							Name:        "gen_ai.provider.cli.oauth.openai.requests.remaining",
							Description: "Remaining OpenAI requests.",
							Unit:        "{request}",
							Kind:        observabilityv1.ObservabilityMetricKind_OBSERVABILITY_METRIC_KIND_GAUGE,
							Category:    observabilityv1.ObservabilityMetricCategory_OBSERVABILITY_METRIC_CATEGORY_RATE_LIMIT,
						},
						{
							Name:        "gen_ai.provider.cli.oauth.openai.requests.reset.seconds",
							Description: "Seconds until requests reset.",
							Unit:        "s",
							Kind:        observabilityv1.ObservabilityMetricKind_OBSERVABILITY_METRIC_KIND_GAUGE,
							Category:    observabilityv1.ObservabilityMetricCategory_OBSERVABILITY_METRIC_CATEGORY_RATE_LIMIT,
						},
					},
					Collection: &observabilityv1.ObservabilityProfile_ResponseHeaders{
						ResponseHeaders: &observabilityv1.ResponseHeaderCollection{
							HeaderMetricMappings: []*observabilityv1.HeaderMetricMapping{
								{
									HeaderName: "x-ratelimit-remaining-requests",
									MetricName: "gen_ai.provider.cli.oauth.openai.requests.remaining",
									ValueType:  observabilityv1.HeaderValueType_HEADER_VALUE_TYPE_INT64,
								},
								{
									HeaderName: "x-ratelimit-reset-requests",
									MetricName: "gen_ai.provider.cli.oauth.openai.requests.reset.seconds",
									ValueType:  observabilityv1.HeaderValueType_HEADER_VALUE_TYPE_DURATION_SECONDS,
									Labels: []*observabilityv1.HeaderMetricLabel{{
										Name:  "limit_kind",
										Value: "requests",
									}},
								},
							},
						},
					},
				}},
			},
		},
	}

	rules, err := ResolveOAuthResponseHeaderRules(pkg)
	if err != nil {
		t.Fatalf("ResolveOAuthResponseHeaderRules() error = %v", err)
	}
	if got, want := len(rules), 2; got != want {
		t.Fatalf("rules = %d, want %d", got, want)
	}
	if got, want := rules[0].HeaderName, "x-ratelimit-remaining-requests"; got != want {
		t.Fatalf("rules[0].HeaderName = %q, want %q", got, want)
	}
	if got, want := rules[0].MetricName, "gen_ai.provider.cli.oauth.openai.requests.remaining"; got != want {
		t.Fatalf("metric_name = %q, want %q", got, want)
	}
	if got, want := rules[1].Labels["limit_kind"], "requests"; got != want {
		t.Fatalf("limit_kind = %q, want %q", got, want)
	}
}

func TestResolveOAuthResponseHeaderRulesReturnsEmptyWithoutOAuth(t *testing.T) {
	rules, err := ResolveOAuthResponseHeaderRules(&supportv1.CLI{
		CliId: "codex",
	})
	if err != nil {
		t.Fatalf("ResolveOAuthResponseHeaderRules() error = %v", err)
	}
	if len(rules) != 0 {
		t.Fatalf("rules = %d, want 0", len(rules))
	}
}

func TestResolveOAuthResponseHeaderRulesRejectsConflict(t *testing.T) {
	pkg := &supportv1.CLI{
		CliId: "codex",
		Oauth: &supportv1.OAuthSupport{
			Observability: &observabilityv1.ObservabilityCapability{
				Profiles: []*observabilityv1.ObservabilityProfile{
					{
						ProfileId:   "one",
						DisplayName: "One",
						Collection: &observabilityv1.ObservabilityProfile_ResponseHeaders{
							ResponseHeaders: &observabilityv1.ResponseHeaderCollection{
								HeaderMetricMappings: []*observabilityv1.HeaderMetricMapping{{
									HeaderName: "retry-after",
									MetricName: "gen_ai.provider.runtime.retry_after.seconds",
									ValueType:  observabilityv1.HeaderValueType_HEADER_VALUE_TYPE_DURATION_SECONDS,
								}},
							},
						},
					},
					{
						ProfileId:   "two",
						DisplayName: "Two",
						Collection: &observabilityv1.ObservabilityProfile_ResponseHeaders{
							ResponseHeaders: &observabilityv1.ResponseHeaderCollection{
								HeaderMetricMappings: []*observabilityv1.HeaderMetricMapping{{
									HeaderName: "retry-after",
									MetricName: "gen_ai.provider.runtime.retry_after.timestamp.seconds",
									ValueType:  observabilityv1.HeaderValueType_HEADER_VALUE_TYPE_UNIX_SECONDS,
								}},
							},
						},
					},
				},
			},
		},
	}

	if _, err := ResolveOAuthResponseHeaderRules(pkg); err == nil {
		t.Fatal("ResolveOAuthResponseHeaderRules() error = nil, want conflict")
	}
}
