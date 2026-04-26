package envoyauthprocessor

import corev1 "k8s.io/api/core/v1"

func bindingFromHeaders(headers requestHeaders) authBinding {
	return authBinding{
		RunID:              headers.get(HeaderRunID),
		SessionID:          headers.get(HeaderSessionID),
		CLIID:              headers.get(HeaderCLIID),
		VendorID:           headers.get(HeaderVendorID),
		ProviderID:         headers.get(HeaderProviderID),
		ProviderSurfaceBindingID: headers.get(HeaderProviderSurfaceBindingID),
		ModelID:            headers.get(HeaderModelID),
		SecretNamespace:    headers.get(HeaderCredentialSecretNamespace),
		SecretName:         headers.get(HeaderCredentialSecretName),
		TargetHosts:        splitList(headers.get(HeaderTargetHosts)),
		RequestHeaderNames: splitList(headers.get(HeaderRequestHeaderNames)),
		HeaderValuePrefix:  headers.get(HeaderHeaderValuePrefix),
		AuthAdapterID:      headers.get(HeaderAuthAdapterID),
		ResponseRules:      responseHeaderRulesFromJSON(headers.get(HeaderResponseHeaderRulesJSON)),
	}
}

func bindingFromPod(pod *corev1.Pod) authBinding {
	annotations := pod.GetAnnotations()
	return authBinding{
		RunID:              annotations[AnnotationRunID],
		SessionID:          annotations[AnnotationSessionID],
		CLIID:              annotations[AnnotationCLIID],
		VendorID:           annotations[AnnotationVendorID],
		ProviderID:         annotations[AnnotationProviderID],
		ProviderSurfaceBindingID: annotations[AnnotationProviderSurfaceBindingID],
		ModelID:            annotations[AnnotationModelID],
		SecretNamespace:    annotations[AnnotationCredentialSecretNamespace],
		SecretName:         annotations[AnnotationCredentialSecretName],
		SourceSecretName:   annotations[ProjectedCredentialSourceAnnotation],
		TargetHosts:        splitList(annotations[AnnotationTargetHosts]),
		RequestHeaderNames: splitList(annotations[AnnotationRequestHeaderNames]),
		HeaderValuePrefix:  annotations[AnnotationHeaderValuePrefix],
		AuthAdapterID:      annotations[AnnotationAuthAdapterID],
		ResponseRules:      responseHeaderRulesFromJSON(annotations[AnnotationResponseHeaderRulesJSON]),
	}
}

func bindingFromSecret(secret *corev1.Secret, base authBinding) authBinding {
	if secret == nil {
		return base
	}
	annotations := secret.GetAnnotations()
	labels := secret.GetLabels()
	return authBinding{
		RunID:              firstNonEmpty(base.RunID, labels[ProjectedCredentialRunIDLabel], annotations[AnnotationRunID]),
		SessionID:          firstNonEmpty(base.SessionID, labels[ProjectedCredentialSessionIDLabel], annotations[AnnotationSessionID]),
		CLIID:              firstNonEmpty(base.CLIID, annotations[AnnotationCLIID]),
		VendorID:           firstNonEmpty(base.VendorID, annotations[AnnotationVendorID]),
		ProviderID:         firstNonEmpty(base.ProviderID, annotations[AnnotationProviderID]),
		ProviderSurfaceBindingID: firstNonEmpty(base.ProviderSurfaceBindingID, annotations[AnnotationProviderSurfaceBindingID]),
		ModelID:            base.ModelID,
		SecretNamespace:    firstNonEmpty(base.SecretNamespace, secret.Namespace),
		SecretName:         firstNonEmpty(base.SecretName, secret.Name),
		SourceSecretName:   firstNonEmpty(base.SourceSecretName, annotations[ProjectedCredentialSourceAnnotation]),
		TargetHosts:        firstNonEmptyList(base.TargetHosts, splitList(annotations[AnnotationTargetHosts])),
		RequestHeaderNames: firstNonEmptyList(base.RequestHeaderNames, splitList(annotations[AnnotationRequestHeaderNames])),
		HeaderValuePrefix:  firstNonEmpty(base.HeaderValuePrefix, annotations[AnnotationHeaderValuePrefix]),
		AuthAdapterID:      firstNonEmpty(base.AuthAdapterID, annotations[AnnotationAuthAdapterID]),
		ResponseRules:      firstNonEmptyRules(base.ResponseRules, responseHeaderRulesFromJSON(annotations[AnnotationResponseHeaderRulesJSON])),
	}
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if value != "" {
			return value
		}
	}
	return ""
}

func firstNonEmptyList(values ...[]string) []string {
	for _, value := range values {
		if len(value) > 0 {
			return value
		}
	}
	return nil
}

func firstNonEmptyRules(values ...[]responseHeaderRule) []responseHeaderRule {
	for _, value := range values {
		if len(value) > 0 {
			return value
		}
	}
	return nil
}
