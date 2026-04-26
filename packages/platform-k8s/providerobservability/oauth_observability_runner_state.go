package providerobservability

import (
	"context"
	"fmt"
	"strings"
	"time"

	supportv1 "code-code.internal/go-contract/platform/support/v1"
)

func (r *OAuthObservabilityRunner) resolveActiveQueryPolicy(ctx context.Context, cliID string) (time.Duration, string, bool, error) {
	var cli *supportv1.CLI
	err := retryObservabilityTransientPlatform(ctx, func() error {
		var getErr error
		cli, getErr = r.cliSupport.Get(ctx, strings.TrimSpace(cliID))
		return getErr
	})
	if err != nil {
		if observabilityTransientPlatformError(err) {
			return 0, "", false, err
		}
		return 0, "", false, nil
	}
	return activeQueryPolicy(cli)
}

func activeQueryPolicy(cli *supportv1.CLI) (time.Duration, string, bool, error) {
	if cli == nil || cli.GetOauth() == nil || cli.GetOauth().GetObservability() == nil {
		return 0, "", false, nil
	}
	var (
		pollInterval time.Duration
		collectorID  string
	)
	for _, profile := range cli.GetOauth().GetObservability().GetProfiles() {
		if profile == nil || profile.GetActiveQuery() == nil {
			continue
		}
		currentInterval := profile.GetActiveQuery().GetMinimumPollInterval().AsDuration()
		if currentInterval <= 0 {
			continue
		}
		if pollInterval == 0 || currentInterval < pollInterval {
			pollInterval = currentInterval
		}
		currentCollectorID := strings.TrimSpace(profile.GetActiveQuery().GetCollectorId())
		if currentCollectorID == "" {
			continue
		}
		if collectorID != "" && collectorID != currentCollectorID {
			return 0, "", false, fmt.Errorf("providerobservability: cli oauth active query collector conflict: %q vs %q", collectorID, currentCollectorID)
		}
		collectorID = currentCollectorID
	}
	if pollInterval <= 0 {
		return 0, "", false, nil
	}
	if collectorID == "" {
		collectorID = strings.TrimSpace(cli.GetCliId())
	}
	return pollInterval, collectorID, true, nil
}

func (r *OAuthObservabilityRunner) throttled(providerID string, providerSurfaceBindingID string, now time.Time) (bool, time.Time) {
	stateKey := oauthObservabilityStateKey(providerID, providerSurfaceBindingID)
	if stateKey == "" {
		return false, time.Time{}
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	state, ok := r.states[stateKey]
	if !ok || state.nextAllowedAt.IsZero() {
		return false, time.Time{}
	}
	if now.Before(state.nextAllowedAt) {
		return true, state.nextAllowedAt
	}
	return false, state.nextAllowedAt
}

func (r *OAuthObservabilityRunner) nextAllowed(providerID string, providerSurfaceBindingID string) time.Time {
	stateKey := oauthObservabilityStateKey(providerID, providerSurfaceBindingID)
	if stateKey == "" {
		return time.Time{}
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	state, ok := r.states[stateKey]
	if !ok {
		return time.Time{}
	}
	return state.nextAllowedAt
}

func (r *OAuthObservabilityRunner) recordProbeResult(
	result *OAuthObservabilityProbeResult,
	trigger OAuthObservabilityProbeTrigger,
	cliID string,
	now time.Time,
	backoff time.Duration,
) *OAuthObservabilityProbeResult {
	if result == nil {
		return nil
	}
	if strings.TrimSpace(result.CLIID) == "" {
		result.CLIID = strings.TrimSpace(cliID)
	}
	if backoff <= 0 {
		backoff = oauthObservabilityFailureBackoff
	}
	nextAllowedAt := now.Add(backoff)
	stateKey := oauthObservabilityStateKey(result.ProviderID, result.ProviderSurfaceBindingID)
	if stateKey == "" {
		stateKey = oauthObservabilityStateKey("", result.ProviderSurfaceBindingID)
	}
	r.mu.Lock()
	r.states[stateKey] = oauthObservabilityState{
		lastAttemptAt: now,
		nextAllowedAt: nextAllowedAt,
	}
	r.mu.Unlock()
	result.LastAttemptAt = timePointerCopy(&now)
	result.NextAllowedAt = timePointerCopy(&nextAllowedAt)
	r.metrics.record(result.CLIID, result.ProviderID, trigger, result.Outcome, result.Reason, now, nextAllowedAt)
	return result
}

func oauthObservabilityStateKey(providerID string, providerSurfaceBindingID string) string {
	if providerID := strings.TrimSpace(providerID); providerID != "" {
		return "provider:" + providerID
	}
	if surfaceID := strings.TrimSpace(providerSurfaceBindingID); surfaceID != "" {
		return "surface:" + surfaceID
	}
	return ""
}
