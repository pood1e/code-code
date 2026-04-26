package providerobservability

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	providerv1 "code-code.internal/go-contract/provider/v1"
	"code-code.internal/platform-k8s/outboundhttp"
)

func (r *VendorObservabilityRunner) probeProvider(
	ctx context.Context,
	providerID string,
	surface *providerv1.ProviderSurfaceBinding,
	trigger VendorObservabilityProbeTrigger,
) (probeResult *VendorObservabilityProbeResult, err error) {
	providerID = strings.TrimSpace(providerID)
	providerSurfaceBindingID := ""
	if surface != nil {
		providerSurfaceBindingID = strings.TrimSpace(surface.GetSurfaceId())
	}
	ctx, span := startVendorObservabilityProbeSpan(ctx, providerID, providerSurfaceBindingID, trigger)
	result := &VendorObservabilityProbeResult{
		ProviderID:         providerID,
		ProviderSurfaceBindingID: providerSurfaceBindingID,
		Outcome:            VendorObservabilityProbeOutcomeUnsupported,
	}
	defer func() {
		if probeResult != nil {
			result = probeResult
		}
		recordVendorObservabilitySpanError(span, err, "probe_failed")
		finishVendorObservabilityProbeSpan(span, result)
		span.End()
	}()
	if surface == nil || surface.GetRuntime() == nil {
		return r.recordProbeResult(result, trigger, r.now().UTC(), vendorObservabilityFailureBackoff), nil
	}
	runtime := surface.GetRuntime()
	if providerv1.RuntimeKind(runtime) != providerv1.ProviderSurfaceKind_PROVIDER_SURFACE_KIND_API {
		return r.recordProbeResult(result, trigger, r.now().UTC(), vendorObservabilityFailureBackoff), nil
	}
	result.VendorID = vendorOwnerID(surface)
	if result.VendorID == "" || result.ProviderID == "" {
		result.Message = "vendor_id or provider_id is empty"
		return r.recordProbeResult(result, trigger, r.now().UTC(), vendorObservabilityFailureBackoff), nil
	}
	vendor, err := r.resolveVendor(ctx, result.VendorID)
	if err != nil {
		result.Outcome = VendorObservabilityProbeOutcomeFailed
		result.Reason = observabilityFailureReasonFromError(err)
		result.Message = err.Error()
		return r.recordProbeResult(result, trigger, r.now().UTC(), vendorObservabilityFailureBackoff), nil
	}
	pollInterval, collectorID, supported, err := vendorActiveQueryPolicy(vendor, providerSurfaceBindingID)
	if err != nil {
		result.Outcome = VendorObservabilityProbeOutcomeFailed
		result.Reason = observabilityFailureReasonFromError(err)
		result.Message = err.Error()
		return r.recordProbeResult(result, trigger, r.now().UTC(), vendorObservabilityFailureBackoff), nil
	}
	if !supported {
		result.Message = "vendor observability active_query is not configured"
		return r.recordProbeResult(result, trigger, r.now().UTC(), vendorObservabilityFailureBackoff), nil
	}
	collector, ok := r.collectors[collectorID]
	if !ok {
		result.Message = fmt.Sprintf("collector %q is not registered", collectorID)
		return r.recordProbeResult(result, trigger, r.now().UTC(), vendorObservabilityFailureBackoff), nil
	}
	now := r.now().UTC()
	if trigger != VendorObservabilityProbeTriggerManual {
		if throttled, nextAllowedAt := r.throttled(result.ProviderID, providerSurfaceBindingID, now); throttled {
			result.Outcome = VendorObservabilityProbeOutcomeThrottled
			result.Message = "operation is throttled by minimum interval"
			result.LastAttemptAt = timePointerCopy(&now)
			result.NextAllowedAt = timePointerCopy(&nextAllowedAt)
			r.metrics.record(result.VendorID, result.ProviderID, trigger, result.Outcome, result.Reason, now, nextAllowedAt)
			return result, nil
		}
	}
	credentialID := strings.TrimSpace(surface.GetProviderCredentialRef().GetProviderCredentialId())
	if credentialID == "" {
		result.Message = "provider credential id is empty"
		return r.recordProbeResult(result, trigger, now, vendorObservabilityFailureBackoff), nil
	}
	observabilityAuth := fakeSessionCredential(credentialID)
	httpClient, err := r.httpClient(ctx, observabilityEgressAuth{
		SecretNamespace:    r.namespace,
		SecretName:         credentialID,
		VendorID:           result.VendorID,
		ProviderID:         result.ProviderID,
		ProviderSurfaceBindingID: providerSurfaceBindingID,
		RequestHeaderName:  "authorization",
		HeaderValuePrefix:  "Bearer",
		AuthAdapterID:      vendorObservabilityAuthAdapterID(collector),
	})
	if err != nil {
		result.Outcome = VendorObservabilityProbeOutcomeFailed
		result.Reason = observabilityFailureReasonFromError(err)
		result.Message = err.Error()
		return r.recordProbeResult(result, trigger, now, vendorObservabilityFailureBackoff), nil
	}
	collectResult, collectErr := collector.Collect(ctx, VendorObservabilityCollectInput{
		VendorID:                result.VendorID,
		ProviderID:              result.ProviderID,
		ProviderSurfaceBindingID:      providerSurfaceBindingID,
		CredentialID:            credentialID,
		SurfaceBaseURL:          strings.TrimSpace(providerv1.RuntimeBaseURL(runtime)),
		APIKey:                  observabilityCredentialToken(observabilityAuth),
		ObservabilityCredential: observabilityAuth,
		HTTPClient:              httpClient,
	})
	if collectErr != nil {
		if isVendorObservabilityUnauthorizedError(collectErr) {
			result.Outcome = VendorObservabilityProbeOutcomeAuthBlocked
			result.Reason = vendorObservabilityUnauthorizedReason(collectErr)
		} else {
			result.Outcome = VendorObservabilityProbeOutcomeFailed
			result.Reason = observabilityFailureReasonFromError(collectErr)
		}
		result.Message = collectErr.Error()
		return r.recordProbeResult(result, trigger, now, vendorObservabilityFailureBackoff), nil
	}
	if collectResult != nil {
		r.metrics.recordCollectorValues(result.VendorID, result.ProviderID, collectResult.GaugeRows)
	}
	result.Outcome = VendorObservabilityProbeOutcomeExecuted
	result.Message = "operation completed"
	nextAllowedAfter := pollInterval
	if nextAllowedAfter < vendorObservabilityPendingBackoff {
		nextAllowedAfter = vendorObservabilityPendingBackoff
	}
	return r.recordProbeResult(result, trigger, now, nextAllowedAfter), nil
}

func vendorObservabilityAuthAdapterID(collector VendorObservabilityCollector) string {
	provider, ok := collector.(VendorObservabilityAuthAdapter)
	if !ok {
		return ""
	}
	return strings.TrimSpace(provider.AuthAdapterID())
}

func vendorOwnerID(surface *providerv1.ProviderSurfaceBinding) string {
	if surface == nil {
		return ""
	}
	source := surface.GetSourceRef()
	if source.GetKind() != providerv1.ProviderSurfaceSourceKind_PROVIDER_SURFACE_SOURCE_KIND_VENDOR {
		return ""
	}
	return strings.TrimSpace(source.GetId())
}

func (r *VendorObservabilityRunner) httpClient(ctx context.Context, auth observabilityEgressAuth) (*http.Client, error) {
	client, err := outboundhttp.NewClientFactory().NewClient(ctx)
	if err != nil {
		return nil, err
	}
	return withObservabilityEgressAuth(client, auth), nil
}
