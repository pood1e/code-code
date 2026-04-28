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
			Collection: &ObservabilityProfile_PassiveHttp{
				PassiveHttp: &PassiveHttpTelemetryCollection{
					CapturePoint:  TelemetryCapturePoint_TELEMETRY_CAPTURE_POINT_EGRESS,
					EmitAccessLog: true,
					Transforms: []*HttpHeaderTelemetryTransform{{
						Source:     HttpHeaderSource_HTTP_HEADER_SOURCE_RESPONSE,
						HeaderName: "retry-after",
						MetricName: "gen_ai.provider.runtime.last_seen.timestamp.seconds",
						ValueType:  HeaderValueType_HEADER_VALUE_TYPE_DURATION_SECONDS,
					}},
					Redaction: &HeaderRedactionPolicy{DropRawHeaders: true},
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
			Collection: &ObservabilityProfile_PassiveHttp{
				PassiveHttp: &PassiveHttpTelemetryCollection{
					CapturePoint:  TelemetryCapturePoint_TELEMETRY_CAPTURE_POINT_EGRESS,
					EmitAccessLog: true,
					Transforms: []*HttpHeaderTelemetryTransform{{
						Source:     HttpHeaderSource_HTTP_HEADER_SOURCE_RESPONSE,
						HeaderName: "x-ratelimit-remaining-requests",
						MetricName: "gen_ai.provider.runtime.rate_limit.remaining",
						ValueType:  HeaderValueType_HEADER_VALUE_TYPE_INT64,
						Labels: []*TelemetryMetricLabel{{
							Name:  "resource",
							Value: "requests",
						}},
					}},
					Redaction: &HeaderRedactionPolicy{DropRawHeaders: true},
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
			Collection: &ObservabilityProfile_PassiveHttp{
				PassiveHttp: &PassiveHttpTelemetryCollection{
					CapturePoint: TelemetryCapturePoint_TELEMETRY_CAPTURE_POINT_EGRESS,
					Transforms: []*HttpHeaderTelemetryTransform{{
						Source:     HttpHeaderSource_HTTP_HEADER_SOURCE_RESPONSE,
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

func TestValidateCapabilityRejectsSensitivePassiveHTTPTransform(t *testing.T) {
	capability := &ObservabilityCapability{
		Profiles: []*ObservabilityProfile{{
			ProfileId:   "broken",
			DisplayName: "Broken",
			Metrics: []*ObservabilityMetric{{
				Name:        "gen_ai.provider.runtime.rate_limit.remaining",
				Description: "Remaining rate limit.",
				Unit:        "{count}",
				Kind:        ObservabilityMetricKind_OBSERVABILITY_METRIC_KIND_GAUGE,
				Category:    ObservabilityMetricCategory_OBSERVABILITY_METRIC_CATEGORY_RATE_LIMIT,
			}},
			Collection: &ObservabilityProfile_PassiveHttp{
				PassiveHttp: &PassiveHttpTelemetryCollection{
					CapturePoint: TelemetryCapturePoint_TELEMETRY_CAPTURE_POINT_EGRESS,
					Transforms: []*HttpHeaderTelemetryTransform{{
						Source:     HttpHeaderSource_HTTP_HEADER_SOURCE_REQUEST,
						HeaderName: "authorization",
						MetricName: "gen_ai.provider.runtime.rate_limit.remaining",
						ValueType:  HeaderValueType_HEADER_VALUE_TYPE_INT64,
					}},
					Redaction: &HeaderRedactionPolicy{DropRawHeaders: true},
				},
			},
		}},
	}

	if err := ValidateCapability(capability); err == nil {
		t.Fatal("ValidateCapability() error = nil, want sensitive header rejection")
	}
}

func TestValidateCapabilityRejectsPassiveHTTPWithoutRawHeaderDrop(t *testing.T) {
	capability := &ObservabilityCapability{
		Profiles: []*ObservabilityProfile{{
			ProfileId:   "broken",
			DisplayName: "Broken",
			Metrics: []*ObservabilityMetric{{
				Name:        "gen_ai.provider.runtime.rate_limit.remaining",
				Description: "Remaining rate limit.",
				Unit:        "{count}",
				Kind:        ObservabilityMetricKind_OBSERVABILITY_METRIC_KIND_GAUGE,
				Category:    ObservabilityMetricCategory_OBSERVABILITY_METRIC_CATEGORY_RATE_LIMIT,
			}},
			Collection: &ObservabilityProfile_PassiveHttp{
				PassiveHttp: &PassiveHttpTelemetryCollection{
					CapturePoint: TelemetryCapturePoint_TELEMETRY_CAPTURE_POINT_EGRESS,
					Transforms: []*HttpHeaderTelemetryTransform{{
						Source:     HttpHeaderSource_HTTP_HEADER_SOURCE_RESPONSE,
						HeaderName: "x-ratelimit-remaining-requests",
						MetricName: "gen_ai.provider.runtime.rate_limit.remaining",
						ValueType:  HeaderValueType_HEADER_VALUE_TYPE_INT64,
					}},
					Redaction: &HeaderRedactionPolicy{DropRawHeaders: false},
				},
			},
		}},
	}

	if err := ValidateCapability(capability); err == nil {
		t.Fatal("ValidateCapability() error = nil, want raw header drop requirement")
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

func TestValidateCapabilityAcceptsActiveQueryCredentialBackfills(t *testing.T) {
	capability := &ObservabilityCapability{
		Profiles: []*ObservabilityProfile{{
			ProfileId:   "oauth_management_state",
			DisplayName: "OAuth Management State",
			Metrics: []*ObservabilityMetric{{
				Name:        "gen_ai.provider.cli.oauth.credential.generation",
				Description: "Credential generation.",
				Unit:        "{generation}",
				Kind:        ObservabilityMetricKind_OBSERVABILITY_METRIC_KIND_GAUGE,
				Category:    ObservabilityMetricCategory_OBSERVABILITY_METRIC_CATEGORY_USAGE,
			}},
			Collection: &ObservabilityProfile_ActiveQuery{
				ActiveQuery: &ActiveQueryCollection{
					MinimumPollInterval: durationpb.New(30 * time.Second),
					CollectorId:         "gemini-cli",
					CredentialBackfills: []*CredentialBackfillRule{{
						RuleId:            "project-id",
						Source:            CredentialBackfillSource_CREDENTIAL_BACKFILL_SOURCE_COLLECTOR_OUTPUT,
						SourceName:        "project_id",
						TargetMaterialKey: "project_id",
					}},
				},
			},
		}},
	}

	if err := ValidateCapability(capability); err != nil {
		t.Fatalf("ValidateCapability() error = %v", err)
	}
}

func TestValidateCapabilityAcceptsActiveQueryInputForm(t *testing.T) {
	capability := &ObservabilityCapability{
		Profiles: []*ObservabilityProfile{{
			ProfileId:   "vendor_management_state",
			DisplayName: "Vendor Management State",
			Metrics: []*ObservabilityMetric{{
				Name:        "gen_ai.provider.quota.remaining",
				Description: "Remaining quota.",
				Unit:        "1",
				Kind:        ObservabilityMetricKind_OBSERVABILITY_METRIC_KIND_GAUGE,
				Category:    ObservabilityMetricCategory_OBSERVABILITY_METRIC_CATEGORY_QUOTA,
			}},
			Collection: &ObservabilityProfile_ActiveQuery{
				ActiveQuery: &ActiveQueryCollection{
					MinimumPollInterval: durationpb.New(30 * time.Second),
					InputForm: &ActiveQueryInputForm{
						SchemaId:    "google-ai-studio-session",
						Title:       "Update AI Studio Session",
						ActionLabel: "Update AI Studio Session",
						Fields: []*ActiveQueryInputField{
							{
								FieldId:     "cookie",
								Label:       "Request Cookie",
								Required:    true,
								Sensitive:   true,
								Control:     ActiveQueryInputControl_ACTIVE_QUERY_INPUT_CONTROL_TEXTAREA,
								Persistence: ActiveQueryInputPersistence_ACTIVE_QUERY_INPUT_PERSISTENCE_STORED_MATERIAL,
							},
							{
								FieldId:       "response_set_cookie",
								Label:         "Response Set-Cookie",
								Control:       ActiveQueryInputControl_ACTIVE_QUERY_INPUT_CONTROL_TEXTAREA,
								Persistence:   ActiveQueryInputPersistence_ACTIVE_QUERY_INPUT_PERSISTENCE_TRANSIENT,
								TargetFieldId: "cookie",
								Transform:     ActiveQueryInputValueTransform_ACTIVE_QUERY_INPUT_VALUE_TRANSFORM_MERGE_SET_COOKIE,
							},
						},
					},
				},
			},
		}},
	}

	if err := ValidateCapability(capability); err != nil {
		t.Fatalf("ValidateCapability() error = %v", err)
	}
}

func TestValidateCapabilityRejectsActiveQueryInputFormTransientWithoutStoredTarget(t *testing.T) {
	capability := &ObservabilityCapability{
		Profiles: []*ObservabilityProfile{{
			ProfileId:   "vendor_management_state",
			DisplayName: "Vendor Management State",
			Metrics: []*ObservabilityMetric{{
				Name:        "gen_ai.provider.quota.remaining",
				Description: "Remaining quota.",
				Unit:        "1",
				Kind:        ObservabilityMetricKind_OBSERVABILITY_METRIC_KIND_GAUGE,
				Category:    ObservabilityMetricCategory_OBSERVABILITY_METRIC_CATEGORY_QUOTA,
			}},
			Collection: &ObservabilityProfile_ActiveQuery{
				ActiveQuery: &ActiveQueryCollection{
					MinimumPollInterval: durationpb.New(30 * time.Second),
					InputForm: &ActiveQueryInputForm{
						SchemaId:    "google-ai-studio-session",
						Title:       "Update AI Studio Session",
						ActionLabel: "Update AI Studio Session",
						Fields: []*ActiveQueryInputField{{
							FieldId:       "response_set_cookie",
							Label:         "Response Set-Cookie",
							Control:       ActiveQueryInputControl_ACTIVE_QUERY_INPUT_CONTROL_TEXTAREA,
							Persistence:   ActiveQueryInputPersistence_ACTIVE_QUERY_INPUT_PERSISTENCE_TRANSIENT,
							TargetFieldId: "cookie",
							Transform:     ActiveQueryInputValueTransform_ACTIVE_QUERY_INPUT_VALUE_TRANSFORM_MERGE_SET_COOKIE,
						}},
					},
				},
			},
		}},
	}

	if err := ValidateCapability(capability); err == nil {
		t.Fatal("ValidateCapability() error = nil, want transient target validation")
	}
}

func TestValidateCapabilityRejectsDuplicateCredentialBackfillTargets(t *testing.T) {
	capability := &ObservabilityCapability{
		Profiles: []*ObservabilityProfile{{
			ProfileId:   "oauth_management_state",
			DisplayName: "OAuth Management State",
			Metrics: []*ObservabilityMetric{{
				Name:        "gen_ai.provider.cli.oauth.credential.generation",
				Description: "Credential generation.",
				Unit:        "{generation}",
				Kind:        ObservabilityMetricKind_OBSERVABILITY_METRIC_KIND_GAUGE,
				Category:    ObservabilityMetricCategory_OBSERVABILITY_METRIC_CATEGORY_USAGE,
			}},
			Collection: &ObservabilityProfile_ActiveQuery{
				ActiveQuery: &ActiveQueryCollection{
					MinimumPollInterval: durationpb.New(30 * time.Second),
					CredentialBackfills: []*CredentialBackfillRule{
						{
							RuleId:            "project-id",
							Source:            CredentialBackfillSource_CREDENTIAL_BACKFILL_SOURCE_COLLECTOR_OUTPUT,
							SourceName:        "project_id",
							TargetMaterialKey: "project_id",
						},
						{
							RuleId:            "project-id-alt",
							Source:            CredentialBackfillSource_CREDENTIAL_BACKFILL_SOURCE_COLLECTOR_OUTPUT,
							SourceName:        "project",
							TargetMaterialKey: "project_id",
						},
					},
				},
			},
		}},
	}

	if err := ValidateCapability(capability); err == nil {
		t.Fatal("ValidateCapability() error = nil, want duplicate credential backfill target")
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
