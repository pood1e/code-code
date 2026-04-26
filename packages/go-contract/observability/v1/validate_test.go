package observabilityv1

import (
	"testing"
	"time"

	"google.golang.org/protobuf/types/known/durationpb"
)

func TestValidateCapabilityAcceptsPrometheusCompatibleMetrics(t *testing.T) {
	capability := &ObservabilityCapability{
		Profiles: []*ObservabilityProfile{{
			ProfileId:   "oauth_runtime_core",
			DisplayName: "OAuth Runtime Core",
			Metrics: []*ObservabilityMetric{
				{
					Name:        "gen_ai.provider.runtime.requests.total",
					Description: "Matched runtime requests.",
					Unit:        "{request}",
					Kind:        ObservabilityMetricKind_OBSERVABILITY_METRIC_KIND_COUNTER,
					Category:    ObservabilityMetricCategory_OBSERVABILITY_METRIC_CATEGORY_USAGE,
					Attributes: []*ObservabilityMetricAttribute{{
						Name:             "cli_id",
						Description:      "Stable cli id.",
						RequirementLevel: ObservabilityAttributeRequirementLevel_OBSERVABILITY_ATTRIBUTE_REQUIREMENT_LEVEL_REQUIRED,
					}},
				},
				{
					Name:        "gen_ai.provider.runtime.last_seen.timestamp.seconds",
					Description: "Last runtime sample timestamp.",
					Unit:        "s",
					Kind:        ObservabilityMetricKind_OBSERVABILITY_METRIC_KIND_GAUGE,
					Category:    ObservabilityMetricCategory_OBSERVABILITY_METRIC_CATEGORY_USAGE,
					Attributes: []*ObservabilityMetricAttribute{{
						Name:             "provider_surface_binding_id",
						Description:      "Stable provider endpoint id.",
						RequirementLevel: ObservabilityAttributeRequirementLevel_OBSERVABILITY_ATTRIBUTE_REQUIREMENT_LEVEL_REQUIRED,
					}},
				},
			},
			Collection: &ObservabilityProfile_ResponseHeaders{
				ResponseHeaders: &ResponseHeaderCollection{
					HeaderMetricMappings: []*HeaderMetricMapping{{
						HeaderName: "retry-after",
						MetricName: "gen_ai.provider.runtime.last_seen.timestamp.seconds",
						ValueType:  HeaderValueType_HEADER_VALUE_TYPE_DURATION_SECONDS,
					}},
				},
			},
			MetricQueries: []*MetricQuery{{
				QueryId:     "runtime_rate_limit",
				DisplayName: "Runtime Rate Limit",
				Language:    MetricQueryLanguage_METRIC_QUERY_LANGUAGE_PROMQL,
				Statement:   `sum by (cli_id) (rate(gen_ai.provider.runtime.requests.total[5m]))`,
				MetricNames: []string{"gen_ai.provider.runtime.requests.total"},
				ResultKind:  MetricQueryResultKind_METRIC_QUERY_RESULT_KIND_VECTOR,
			}},
			AvailabilityJudgment: &AvailabilityJudgment{
				SubjectKind:     AvailabilitySubjectKind_AVAILABILITY_SUBJECT_KIND_MODEL,
				SubjectLabelKey: "model_id",
				QueryIds:        []string{"runtime_rate_limit"},
				Rules: []*AvailabilityRule{{
					RuleId:      "available",
					DisplayName: "Available",
					AllOf: []*AvailabilityPredicate{{
						QueryId:   "runtime_rate_limit",
						Operator:  ComparisonOperator_COMPARISON_OPERATOR_GTE,
						Threshold: 0,
					}},
					State: AvailabilityState_AVAILABILITY_STATE_AVAILABLE,
				}},
			},
		}},
	}

	if err := ValidateCapability(capability); err != nil {
		t.Fatalf("ValidateCapability() error = %v", err)
	}
}

func TestValidateCapabilityAcceptsResponseHeaderLabels(t *testing.T) {
	capability := &ObservabilityCapability{
		Profiles: []*ObservabilityProfile{{
			ProfileId:   "vendor_runtime",
			DisplayName: "Vendor Runtime",
			Metrics: []*ObservabilityMetric{{
				Name:        "gen_ai.provider.runtime.rate_limit.remaining",
				Description: "Remaining fireworks rate limit.",
				Unit:        "{count}",
				Kind:        ObservabilityMetricKind_OBSERVABILITY_METRIC_KIND_GAUGE,
				Category:    ObservabilityMetricCategory_OBSERVABILITY_METRIC_CATEGORY_RATE_LIMIT,
				Attributes: []*ObservabilityMetricAttribute{
					{Name: "vendor_id", Description: "Vendor.", RequirementLevel: ObservabilityAttributeRequirementLevel_OBSERVABILITY_ATTRIBUTE_REQUIREMENT_LEVEL_REQUIRED},
					{Name: "provider_account_id", Description: "Account.", RequirementLevel: ObservabilityAttributeRequirementLevel_OBSERVABILITY_ATTRIBUTE_REQUIREMENT_LEVEL_REQUIRED},
					{Name: "provider_surface_binding_id", Description: "Endpoint.", RequirementLevel: ObservabilityAttributeRequirementLevel_OBSERVABILITY_ATTRIBUTE_REQUIREMENT_LEVEL_REQUIRED},
					{Name: "resource", Description: "Resource.", RequirementLevel: ObservabilityAttributeRequirementLevel_OBSERVABILITY_ATTRIBUTE_REQUIREMENT_LEVEL_REQUIRED},
				},
			}},
			Collection: &ObservabilityProfile_ResponseHeaders{
				ResponseHeaders: &ResponseHeaderCollection{
					HeaderMetricMappings: []*HeaderMetricMapping{{
						HeaderName: "x-ratelimit-remaining-requests",
						MetricName: "gen_ai.provider.runtime.rate_limit.remaining",
						ValueType:  HeaderValueType_HEADER_VALUE_TYPE_INT64,
						Labels: []*HeaderMetricLabel{{
							Name:  "resource",
							Value: "requests",
						}},
					}},
				},
			},
		}},
	}

	if err := ValidateCapability(capability); err != nil {
		t.Fatalf("ValidateCapability() error = %v", err)
	}
}

func TestValidateCapabilityRejectsInvalidCounterName(t *testing.T) {
	capability := &ObservabilityCapability{
		Profiles: []*ObservabilityProfile{{
			ProfileId:   "broken",
			DisplayName: "Broken",
			Metrics: []*ObservabilityMetric{{
				Name:        "gen_ai.provider.runtime.requests",
				Description: "Broken counter.",
				Unit:        "{request}",
				Kind:        ObservabilityMetricKind_OBSERVABILITY_METRIC_KIND_COUNTER,
				Category:    ObservabilityMetricCategory_OBSERVABILITY_METRIC_CATEGORY_USAGE,
			}},
			Collection: &ObservabilityProfile_ActiveQuery{
				ActiveQuery: &ActiveQueryCollection{
					MinimumPollInterval: durationpb.New(5 * time.Second),
				},
			},
		}},
	}

	if err := ValidateCapability(capability); err == nil {
		t.Fatal("ValidateCapability() error = nil, want invalid counter name")
	}
}

func TestValidateCapabilityRejectsUnknownMetricReference(t *testing.T) {
	capability := &ObservabilityCapability{
		Profiles: []*ObservabilityProfile{{
			ProfileId:   "broken",
			DisplayName: "Broken",
			Metrics: []*ObservabilityMetric{{
				Name:        "gen_ai.provider.runtime.requests.total",
				Description: "Runtime requests.",
				Unit:        "{request}",
				Kind:        ObservabilityMetricKind_OBSERVABILITY_METRIC_KIND_COUNTER,
				Category:    ObservabilityMetricCategory_OBSERVABILITY_METRIC_CATEGORY_USAGE,
			}},
			Collection: &ObservabilityProfile_ResponseHeaders{
				ResponseHeaders: &ResponseHeaderCollection{
					HeaderMetricMappings: []*HeaderMetricMapping{{
						HeaderName: "retry-after",
						MetricName: "gen_ai.provider.runtime.retry_after.seconds",
						ValueType:  HeaderValueType_HEADER_VALUE_TYPE_DURATION_SECONDS,
					}},
				},
			},
		}},
	}

	if err := ValidateCapability(capability); err == nil {
		t.Fatal("ValidateCapability() error = nil, want unknown metric reference")
	}
}

func TestValidateCapabilityAcceptsActiveQueryCollectorID(t *testing.T) {
	capability := &ObservabilityCapability{
		Profiles: []*ObservabilityProfile{{
			ProfileId:   "oauth_management_state",
			DisplayName: "OAuth Management State",
			Metrics: []*ObservabilityMetric{{
				Name:        "gen_ai.provider.cli.oauth.session.starts.total",
				Description: "Session starts.",
				Unit:        "{session}",
				Kind:        ObservabilityMetricKind_OBSERVABILITY_METRIC_KIND_COUNTER,
				Category:    ObservabilityMetricCategory_OBSERVABILITY_METRIC_CATEGORY_USAGE,
			}},
			Collection: &ObservabilityProfile_ActiveQuery{
				ActiveQuery: &ActiveQueryCollection{
					MinimumPollInterval: durationpb.New(30 * time.Second),
					CollectorId:         "gemini-cli",
				},
			},
		}},
	}

	if err := ValidateCapability(capability); err != nil {
		t.Fatalf("ValidateCapability() error = %v", err)
	}
}

func TestValidateCapabilityRejectsInvalidActiveQueryCollectorID(t *testing.T) {
	capability := &ObservabilityCapability{
		Profiles: []*ObservabilityProfile{{
			ProfileId:   "oauth_management_state",
			DisplayName: "OAuth Management State",
			Metrics: []*ObservabilityMetric{{
				Name:        "gen_ai.provider.cli.oauth.session.starts.total",
				Description: "Session starts.",
				Unit:        "{session}",
				Kind:        ObservabilityMetricKind_OBSERVABILITY_METRIC_KIND_COUNTER,
				Category:    ObservabilityMetricCategory_OBSERVABILITY_METRIC_CATEGORY_USAGE,
			}},
			Collection: &ObservabilityProfile_ActiveQuery{
				ActiveQuery: &ActiveQueryCollection{
					MinimumPollInterval: durationpb.New(30 * time.Second),
					CollectorId:         "Gemini@Collector",
				},
			},
		}},
	}

	if err := ValidateCapability(capability); err == nil {
		t.Fatal("ValidateCapability() error = nil, want invalid collector_id")
	}
}
