package providerobservability

import (
	"testing"
	"time"

	observabilityv1 "code-code.internal/go-contract/observability/v1"
	supportv1 "code-code.internal/go-contract/platform/support/v1"
	vendordefinitionv1 "code-code.internal/go-contract/vendor_definition/v1"
	"google.golang.org/protobuf/types/known/durationpb"
)

func TestVendorActiveQueryPolicyResolvesCollectorAndInterval(t *testing.T) {
	vendor := &supportv1.Vendor{
		Vendor: &vendordefinitionv1.Vendor{VendorId: "minimax"},
		ProviderBindings: []*supportv1.VendorProviderBinding{{
			Observability: &observabilityv1.ObservabilityCapability{
				Profiles: []*observabilityv1.ObservabilityProfile{
					{
						ProfileId:   "quota",
						DisplayName: "Quota",
						Metrics: []*observabilityv1.ObservabilityMetric{{
							Name:        "gen_ai.provider.quota.remaining.fraction.percent",
							Description: "Remaining percent.",
							Unit:        "%",
							Kind:        observabilityv1.ObservabilityMetricKind_OBSERVABILITY_METRIC_KIND_GAUGE,
							Category:    observabilityv1.ObservabilityMetricCategory_OBSERVABILITY_METRIC_CATEGORY_QUOTA,
						}},
						Collection: &observabilityv1.ObservabilityProfile_ActiveQuery{
							ActiveQuery: &observabilityv1.ActiveQueryCollection{
								CollectorId:         "minimax-remains",
								MinimumPollInterval: durationpb.New(30 * time.Minute),
							},
						},
					},
				},
			},
		}},
	}
	interval, collectorID, supported, err := vendorActiveQueryPolicy(vendor, "")
	if err != nil {
		t.Fatalf("vendorActiveQueryPolicy() error = %v", err)
	}
	if !supported {
		t.Fatal("supported = false, want true")
	}
	if got, want := interval, 30*time.Minute; got != want {
		t.Fatalf("interval = %v, want %v", got, want)
	}
	if got, want := collectorID, "minimax-remains"; got != want {
		t.Fatalf("collector_id = %q, want %q", got, want)
	}
}

func TestVendorActiveQueryPolicyRejectsCollectorConflict(t *testing.T) {
	vendor := &supportv1.Vendor{
		Vendor: &vendordefinitionv1.Vendor{VendorId: "minimax"},
		ProviderBindings: []*supportv1.VendorProviderBinding{{
			Observability: &observabilityv1.ObservabilityCapability{
				Profiles: []*observabilityv1.ObservabilityProfile{
					{
						ProfileId:   "quota-1",
						DisplayName: "Quota 1",
						Metrics: []*observabilityv1.ObservabilityMetric{{
							Name:        "gen_ai.provider.quota.remaining.fraction.percent",
							Description: "Remaining percent.",
							Unit:        "%",
							Kind:        observabilityv1.ObservabilityMetricKind_OBSERVABILITY_METRIC_KIND_GAUGE,
							Category:    observabilityv1.ObservabilityMetricCategory_OBSERVABILITY_METRIC_CATEGORY_QUOTA,
						}},
						Collection: &observabilityv1.ObservabilityProfile_ActiveQuery{
							ActiveQuery: &observabilityv1.ActiveQueryCollection{
								CollectorId:         "collector-a",
								MinimumPollInterval: durationpb.New(30 * time.Minute),
							},
						},
					},
					{
						ProfileId:   "quota-2",
						DisplayName: "Quota 2",
						Metrics: []*observabilityv1.ObservabilityMetric{{
							Name:        "gen_ai.provider.quota.remaining",
							Description: "Remaining count.",
							Unit:        "{count}",
							Kind:        observabilityv1.ObservabilityMetricKind_OBSERVABILITY_METRIC_KIND_GAUGE,
							Category:    observabilityv1.ObservabilityMetricCategory_OBSERVABILITY_METRIC_CATEGORY_QUOTA,
						}},
						Collection: &observabilityv1.ObservabilityProfile_ActiveQuery{
							ActiveQuery: &observabilityv1.ActiveQueryCollection{
								CollectorId:         "collector-b",
								MinimumPollInterval: durationpb.New(30 * time.Minute),
							},
						},
					},
				},
			},
		}},
	}
	if _, _, _, err := vendorActiveQueryPolicy(vendor, ""); err == nil {
		t.Fatal("vendorActiveQueryPolicy() error = nil, want collector conflict error")
	}
}
