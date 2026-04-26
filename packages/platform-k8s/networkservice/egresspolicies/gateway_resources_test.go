package egresspolicies

import (
	"testing"

	istionetworking "istio.io/api/networking/v1alpha3"
)

func TestEndpointResourceNameIsStableDNSLabel(t *testing.T) {
	name := targetResourceName("oauth2.googleapis.com")
	if len(name) > 63 {
		t.Fatalf("target resource name length = %d, want <= 63", len(name))
	}
	if name != targetResourceName("oauth2.googleapis.com") {
		t.Fatal("target resource name is not stable")
	}
}

func TestSharedGatewayUsesSingleTLSPassthroughServer(t *testing.T) {
	target := testEndpoint("oauth2.googleapis.com")
	runtime := testGatewayRuntime()
	gateway := sharedGateway(runtime, []egressTarget{target})
	if gateway.Spec.GetSelector()["istio"] != runtime.selector {
		t.Fatalf("selector = %v", gateway.Spec.GetSelector())
	}
	servers := gateway.Spec.GetServers()
	if len(servers) != 1 {
		t.Fatalf("servers = %d, want 1", len(servers))
	}
	server := servers[0]
	if server.GetPort().GetProtocol() != "TLS" {
		t.Fatalf("protocol = %q, want TLS", server.GetPort().GetProtocol())
	}
	if server.GetTls().GetMode() != istionetworking.ServerTLSSettings_PASSTHROUGH {
		t.Fatalf("tls mode = %q, want PASSTHROUGH", server.GetTls().GetMode())
	}
}

func TestTargetVirtualServiceRoutesDirectAndProxy(t *testing.T) {
	proxy := egressProxyAddress{proxyID: "preset-proxy", address: "proxy.local", port: 10809}
	target := testEndpoint("api.mistral.ai")
	target.action = egressActionProxy
	target.proxyID = proxy.proxyID

	meshVirtualService := targetVirtualService("code-code", testGatewayRuntime(), target, map[string]egressProxyAddress{proxy.proxyID: proxy})
	if len(meshVirtualService.Spec.GetGateways()) != 1 || meshVirtualService.Spec.GetGateways()[0] != "mesh" {
		t.Fatalf("mesh gateways = %v, want [mesh]", meshVirtualService.Spec.GetGateways())
	}
	if len(meshVirtualService.Spec.GetTls()) != 1 {
		t.Fatalf("mesh tls routes = %d, want 1", len(meshVirtualService.Spec.GetTls()))
	}
	meshDestinationHost := meshVirtualService.Spec.GetTls()[0].GetRoute()[0].GetDestination().GetHost()
	if meshDestinationHost != testGatewayRuntime().serviceHost {
		t.Fatalf("mesh destination host = %q, want %q", meshDestinationHost, testGatewayRuntime().serviceHost)
	}

	gatewayVirtualService := targetGatewayVirtualService(testGatewayRuntime(), target, map[string]egressProxyAddress{proxy.proxyID: proxy})
	if len(gatewayVirtualService.Spec.GetGateways()) != 1 || gatewayVirtualService.Spec.GetGateways()[0] != gatewayName {
		t.Fatalf("gateway gateways = %v, want [%s]", gatewayVirtualService.Spec.GetGateways(), gatewayName)
	}
	if len(gatewayVirtualService.Spec.GetTls()) != 1 {
		t.Fatalf("gateway tls routes = %d, want 1", len(gatewayVirtualService.Spec.GetTls()))
	}
	gatewayDestinationHost := gatewayVirtualService.Spec.GetTls()[0].GetRoute()[0].GetDestination().GetHost()
	if gatewayDestinationHost != proxyServiceHost(proxy) {
		t.Fatalf("gateway destination host = %q, want %q", gatewayDestinationHost, proxyServiceHost(proxy))
	}
}
