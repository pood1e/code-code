package main

import (
	"context"
	"log"
	"net"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	profileservicev1 "code-code.internal/go-contract/platform/profile/v1"
	"code-code.internal/platform-k8s/internal/platform/state"
	"code-code.internal/platform-k8s/internal/platform/telemetry"
	"code-code.internal/platform-k8s/internal/profileservice"
	"go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/health"
	healthv1 "google.golang.org/grpc/health/grpc_health_v1"
)

func main() {
	addr := envOrDefault("PLATFORM_PROFILE_SERVICE_GRPC_ADDR", ":8081")
	providerAddr := envOrDefault("PLATFORM_PROFILE_SERVICE_PROVIDER_GRPC_ADDR", "platform-provider-service:8081")
	cliRuntimeAddr := envOrDefault("PLATFORM_PROFILE_SERVICE_CLI_RUNTIME_GRPC_ADDR", "platform-cli-runtime-service:8081")
	supportAddr := envOrDefault("PLATFORM_PROFILE_SERVICE_SUPPORT_GRPC_ADDR", "platform-support-service:8081")
	databaseURL := firstEnv("PLATFORM_DATABASE_URL", "PLATFORM_PROFILE_SERVICE_DATABASE_URL")

	telemetryShutdown, err := telemetry.Setup(context.Background(), envOrDefault("OTEL_SERVICE_NAME", "platform-profile-service"))
	must(err)
	defer func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = telemetryShutdown(ctx)
	}()

	statePool, err := state.OpenPostgres(context.Background(), databaseURL, "platform-profile-service")
	must(err)
	defer statePool.Close()

	providerConn, err := grpc.NewClient(providerAddr, grpc.WithTransportCredentials(insecure.NewCredentials()), grpc.WithStatsHandler(otelgrpc.NewClientHandler()))
	must(err)
	defer func() { _ = providerConn.Close() }()
	cliRuntimeConn, err := grpc.NewClient(cliRuntimeAddr, grpc.WithTransportCredentials(insecure.NewCredentials()), grpc.WithStatsHandler(otelgrpc.NewClientHandler()))
	must(err)
	defer func() { _ = cliRuntimeConn.Close() }()
	supportConn, err := grpc.NewClient(supportAddr, grpc.WithTransportCredentials(insecure.NewCredentials()), grpc.WithStatsHandler(otelgrpc.NewClientHandler()))
	must(err)
	defer func() { _ = supportConn.Close() }()

	server, err := profileservice.NewServer(profileservice.Config{
		ProviderConn:   providerConn,
		CLIRuntimeConn: cliRuntimeConn,
		SupportConn:    supportConn,
		StatePool:      statePool,
	})
	must(err)

	listener, err := net.Listen("tcp", addr)
	must(err)
	grpcServer := grpc.NewServer(grpc.StatsHandler(otelgrpc.NewServerHandler()))
	profileservicev1.RegisterProfileServiceServer(grpcServer, server)
	healthServer := health.NewServer()
	healthServer.SetServingStatus("", healthv1.HealthCheckResponse_SERVING)
	healthServer.SetServingStatus(profileservicev1.ProfileService_ServiceDesc.ServiceName, healthv1.HealthCheckResponse_SERVING)
	healthv1.RegisterHealthServer(grpcServer, healthServer)

	go func() {
		sigCh := make(chan os.Signal, 1)
		signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
		<-sigCh
		log.Println("shutting down platform-profile-service...")
		healthServer.SetServingStatus("", healthv1.HealthCheckResponse_NOT_SERVING)
		healthServer.SetServingStatus(profileservicev1.ProfileService_ServiceDesc.ServiceName, healthv1.HealthCheckResponse_NOT_SERVING)
		grpcServer.GracefulStop()
	}()

	log.Printf("platform-profile-service listening on %s (provider=%s cli_runtime=%s support=%s)", addr, providerAddr, cliRuntimeAddr, supportAddr)
	if err := grpcServer.Serve(listener); err != nil {
		must(err)
	}
}

func envOrDefault(key, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	return value
}

func firstEnv(keys ...string) string {
	for _, key := range keys {
		value := strings.TrimSpace(os.Getenv(key))
		if value != "" {
			return value
		}
	}
	return ""
}

func must(err error) {
	if err != nil {
		log.Fatal(err)
	}
}
