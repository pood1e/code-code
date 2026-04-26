package egresspolicies

import (
	"fmt"
	"strings"
)

// GatewayRuntimeConfig identifies the Istio egress gateway workload and service.
type GatewayRuntimeConfig struct {
	Namespace   string
	ServiceHost string
	Selector    string
}

type gatewayRuntime struct {
	namespace   string
	serviceHost string
	selector    string
}

func newGatewayRuntime(config GatewayRuntimeConfig) (gatewayRuntime, error) {
	runtime := gatewayRuntime{
		namespace:   strings.TrimSpace(config.Namespace),
		serviceHost: strings.TrimSpace(config.ServiceHost),
		selector:    strings.TrimSpace(config.Selector),
	}
	if runtime.namespace == "" {
		return gatewayRuntime{}, fmt.Errorf("platformk8s/networkservice/egresspolicies: egress gateway namespace is empty")
	}
	if runtime.serviceHost == "" {
		return gatewayRuntime{}, fmt.Errorf("platformk8s/networkservice/egresspolicies: egress gateway service host is empty")
	}
	if runtime.selector == "" {
		return gatewayRuntime{}, fmt.Errorf("platformk8s/networkservice/egresspolicies: egress gateway selector is empty")
	}
	return runtime, nil
}

func (r gatewayRuntime) gatewayRef() string {
	return r.namespace + "/" + gatewayName
}
