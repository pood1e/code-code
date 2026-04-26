package egresspolicies

func targetLabels(target egressTarget) map[string]string {
	labels := map[string]string{
		labelEgressRole:   egressRoleTarget,
		labelEgressSource: target.source,
	}
	if target.ruleSetID != "" {
		labels[labelEgressRuleSetID] = target.ruleSetID
	}
	if target.ruleID != "" {
		labels[labelEgressRuleID] = target.ruleID
	}
	if target.action == egressActionProxy {
		labels[labelEgressProxyID] = target.proxyID
	}
	return labels
}

func targetAnnotations(target egressTarget) map[string]string {
	return mergeStringMaps(nil, map[string]string{
		annotationDisplayName: target.displayName,
		annotationSourceURL:   target.sourceURL,
	})
}

func proxyLabels(proxy egressProxyAddress) map[string]string {
	return map[string]string{
		labelEgressRole:    egressRoleProxy,
		labelEgressProxyID: proxy.proxyID,
	}
}

func proxyAnnotations(proxy egressProxyAddress) map[string]string {
	return mergeStringMaps(nil, map[string]string{
		annotationDisplayName: proxy.displayName,
	})
}

func gatewayResourceLabels() map[string]string {
	return map[string]string{labelEgressRole: egressRoleGateway}
}
