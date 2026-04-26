package egresspolicies

import (
	"fmt"
	"sort"

	ctrlclient "sigs.k8s.io/controller-runtime/pkg/client"
)

func proxyDestinationRules(
	namespace string,
	targets []egressTarget,
	proxyByID map[string]egressProxyAddress,
) []ctrlclient.Object {
	proxyTargets := targetsByProxyID(targets)
	proxyIDs := make([]string, 0, len(proxyTargets))
	for proxyID := range proxyTargets {
		proxyIDs = append(proxyIDs, proxyID)
	}
	sort.Strings(proxyIDs)

	out := make([]ctrlclient.Object, 0, len(proxyIDs))
	for _, proxyID := range proxyIDs {
		proxy, ok := proxyByID[proxyID]
		if ok {
			if targets := proxyTargets[proxyID]; len(targets) > 0 {
				out = append(out, proxyDestinationRule(namespace, proxy, targets))
			}
		}
	}
	return out
}

func targetsByProxyID(targets []egressTarget) map[string][]egressTarget {
	out := map[string][]egressTarget{}
	for _, target := range targets {
		if target.action == egressActionProxy && target.proxyID != "" {
			out[target.proxyID] = append(out[target.proxyID], target)
		}
	}
	return out
}

func proxyServiceHost(proxy egressProxyAddress) string {
	return fmt.Sprintf("%s.egress-proxy.code-code.internal", proxy.proxyID)
}
