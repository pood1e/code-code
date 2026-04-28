package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"code-code.internal/platform-k8s/internal/notificationdispatcher"
)

func main() {
	dispatcher, err := notificationdispatcher.New(notificationdispatcher.Config{
		NATSURL:      envOrDefault("NOTIFICATION_DISPATCHER_NATS_URL", "nats://nats.code-code-infra.svc.cluster.local:4222"),
		StreamName:   envOrDefault("NOTIFICATION_DISPATCHER_STREAM", notificationdispatcher.DefaultStreamName),
		Subject:      envOrDefault("NOTIFICATION_DISPATCHER_SUBJECT", notificationdispatcher.DefaultSubject),
		ConsumerName: envOrDefault("NOTIFICATION_DISPATCHER_CONSUMER", notificationdispatcher.DefaultConsumerName),
		AppriseURL:   envOrDefault("NOTIFICATION_DISPATCHER_APPRISE_URL", notificationdispatcher.DefaultAppriseURL),
	})
	if err != nil {
		log.Fatal(err)
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	healthServer := healthHTTPServer(envOrDefault("NOTIFICATION_DISPATCHER_HTTP_ADDR", ":8080"))
	errCh := make(chan error, 2)
	go func() {
		errCh <- dispatcher.Run(ctx)
	}()
	go func() {
		if err := healthServer.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			errCh <- err
		}
	}()

	log.Printf("notification-dispatcher starting (subject=%s)", envOrDefault("NOTIFICATION_DISPATCHER_SUBJECT", notificationdispatcher.DefaultSubject))
	select {
	case err := <-errCh:
		if err != nil && !errors.Is(err, context.Canceled) {
			log.Fatal(err)
		}
	case <-ctx.Done():
	}
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_ = healthServer.Shutdown(shutdownCtx)
}

func healthHTTPServer(addr string) *http.Server {
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})
	return &http.Server{Addr: addr, Handler: mux}
}

func envOrDefault(key string, fallback string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	return value
}
