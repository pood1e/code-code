package egresspolicies

const (
	egressLabelPrefix          = "egress.platform.code-code.internal"
	labelEgressRole            = egressLabelPrefix + "/role"
	labelEgressSource          = egressLabelPrefix + "/source"
	labelEgressRuleSetID       = egressLabelPrefix + "/ruleset-id"
	labelEgressRuleID          = egressLabelPrefix + "/rule-id"
	labelEgressProxyID         = egressLabelPrefix + "/proxy-id"
	annotationDisplayName      = egressLabelPrefix + "/display-name"
	annotationSourceURL        = egressLabelPrefix + "/source-url"
	egressRoleGateway          = "gateway"
	egressRoleTarget           = "target"
	egressRoleProxy            = "proxy"
	egressRolePolicy           = "policy"
	egressSourceRuleSet        = "ruleset"
	egressSourceCustom         = "custom"
	egressSourceSystem         = "system"
	externalRuleSetID          = "external.autoproxy"
	externalRuleSetDisplayName = "AutoProxy"
	egressActionDirect         = "direct"
	egressActionProxy          = "proxy"
	targetResourcePrefix       = "code-code-egress-host"
	proxyResourcePrefix        = "code-code-egress-proxy"
)

func gatewayLabels() map[string]string {
	return map[string]string{
		"app.kubernetes.io/name":       "code-code-egress",
		"app.kubernetes.io/component":  "egress-gateway",
		"app.kubernetes.io/part-of":    "code-code",
		"app.kubernetes.io/managed-by": fieldOwner,
	}
}

func mergeStringMaps(base map[string]string, overlays ...map[string]string) map[string]string {
	out := map[string]string{}
	for key, value := range base {
		out[key] = value
	}
	for _, overlay := range overlays {
		for key, value := range overlay {
			if value != "" {
				out[key] = value
			}
		}
	}
	if len(out) == 0 {
		return nil
	}
	return out
}
