package main

import (
	"context"
	"log"
	"os/signal"
	"syscall"

	"code-code.internal/cli-output-sidecar/internal/app"
	"code-code.internal/cli-output-sidecar/internal/parsers"
)

func main() {
	cfg, err := app.LoadConfigFromEnv()
	if err != nil {
		log.Fatal(err)
	}
	registry, err := parsers.NewBuiltinRegistry()
	if err != nil {
		log.Fatal(err)
	}
	runtime, err := app.New(cfg, registry)
	if err != nil {
		log.Fatal(err)
	}
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()
	if err := runtime.Run(ctx); err != nil {
		log.Fatal(err)
	}
}
