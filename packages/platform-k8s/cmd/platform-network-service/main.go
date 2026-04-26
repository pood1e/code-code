package main

import (
	"context"
	"fmt"
	"log"
	"net"
	"os"
	"os/signal"
	"syscall"
	"time"

	egressservicev1 "code-code.internal/go-contract/platform/egress/v1"
	"code-code.internal/platform-k8s/networkservice"
	"code-code.internal/platform-k8s/telemetry"
	"go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc"
	"google.golang.org/grpc"
	"google.golang.org/grpc/health"
	healthv1 "google.golang.org/grpc/health/grpc_health_v1"
	istionetworkingv1 "istio.io/client-go/pkg/apis/networking/v1"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/runtime"
	ctrl "sigs.k8s.io/controller-runtime"
	ctrlclient "sigs.k8s.io/controller-runtime/pkg/client"
)

func main() {
	addr := envOrDefault("PLATFORM_NETWORK_SERVICE_GRPC_ADDR", ":8081")
	namespace := envOrDefault("PLATFORM_NETWORK_SERVICE_NAMESPACE", "code-code")
	egressGatewayNamespace := envOrDefault("PLATFORM_NETWORK_SERVICE_EGRESS_GATEWAY_NAMESPACE", "code-code-net")
	egressGatewayServiceHost := envOrDefault(
		"PLATFORM_NETWORK_SERVICE_EGRESS_GATEWAY_SERVICE_HOST",
		fmt.Sprintf("code-code-egressgateway.%s.svc.cluster.local", egressGatewayNamespace),
	)
	egressGatewaySelector := envOrDefault("PLATFORM_NETWORK_SERVICE_EGRESS_GATEWAY_SELECTOR", "code-code-egressgateway")

	telemetryShutdown, err := telemetry.Setup(context.Background(), envOrDefault("OTEL_SERVICE_NAME", "platform-network-service"))
	must(err)
	defer func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = telemetryShutdown(ctx)
	}()

	scheme := runtime.NewScheme()
	must(appsv1.AddToScheme(scheme))
	must(corev1.AddToScheme(scheme))
	must(istionetworkingv1.AddToScheme(scheme))

	restConfig := ctrl.GetConfigOrDie()
	kubeClient, err := ctrlclient.New(restConfig, ctrlclient.Options{Scheme: scheme})
	must(err)

	server, err := networkservice.NewServer(networkservice.Config{
		Client:                   kubeClient,
		Reader:                   kubeClient,
		Namespace:                namespace,
		EgressGatewayNamespace:   egressGatewayNamespace,
		EgressGatewayServiceHost: egressGatewayServiceHost,
		EgressGatewaySelector:    egressGatewaySelector,
	})
	must(err)

	listener, err := net.Listen("tcp", addr)
	must(err)
	grpcServer := grpc.NewServer(grpc.StatsHandler(otelgrpc.NewServerHandler()))
	egressservicev1.RegisterEgressServiceServer(grpcServer, server)
	healthServer := health.NewServer()
	healthServer.SetServingStatus("", healthv1.HealthCheckResponse_SERVING)
	healthServer.SetServingStatus(egressservicev1.EgressService_ServiceDesc.ServiceName, healthv1.HealthCheckResponse_SERVING)
	healthv1.RegisterHealthServer(grpcServer, healthServer)

	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()
	serveErr := make(chan error, 1)
	go func() { serveErr <- grpcServer.Serve(listener) }()

	log.Printf("platform-network-service listening on %s (namespace=%s, egressGatewayNamespace=%s)", addr, namespace, egressGatewayNamespace)
	select {
	case err := <-serveErr:
		must(err)
	case <-ctx.Done():
		log.Println("shutting down platform-network-service...")
		healthServer.SetServingStatus("", healthv1.HealthCheckResponse_NOT_SERVING)
		healthServer.SetServingStatus(egressservicev1.EgressService_ServiceDesc.ServiceName, healthv1.HealthCheckResponse_NOT_SERVING)
		grpcServer.Stop()
	}
}

func envOrDefault(key, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	return value
}

func must(err error) {
	if err != nil {
		log.Fatal(err)
	}
}
