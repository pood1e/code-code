package main

import (
	"log"
	"log/slog"
	"os"
	"strings"

	"code-code.internal/platform-k8s/wecomcallback"
)

func main() {
	publisher, err := wecomcallback.NewNATSPublisher(
		envOrDefault("WECOM_CALLBACK_NATS_URL", "nats://nats.code-code-infra.svc.cluster.local:4222"),
		envOrDefault("WECOM_CALLBACK_NATS_SUBJECT", "platform.wecom.messages.received"),
	)
	if err != nil {
		log.Fatal(err)
	}
	defer publisher.Close()

	server, err := wecomcallback.NewServer(wecomcallback.Config{
		Addr:           envOrDefault("WECOM_CALLBACK_HTTP_ADDR", ":8080"),
		Path:           envOrDefault("WECOM_CALLBACK_PATH", "/wecom/callback"),
		Token:          requiredEnv("WECOM_CALLBACK_TOKEN"),
		EncodingAESKey: requiredEnv("WECOM_CALLBACK_ENCODING_AES_KEY"),
	}, publisher, slog.Default())
	if err != nil {
		log.Fatal(err)
	}
	log.Printf("wecom-callback-adapter listening on %s path=%s", envOrDefault("WECOM_CALLBACK_HTTP_ADDR", ":8080"), envOrDefault("WECOM_CALLBACK_PATH", "/wecom/callback"))
	if err := server.ListenAndServe(); err != nil {
		log.Fatal(err)
	}
}

func envOrDefault(key string, fallback string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	return value
}

func requiredEnv(key string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		log.Fatalf("%s is required", key)
	}
	return value
}
