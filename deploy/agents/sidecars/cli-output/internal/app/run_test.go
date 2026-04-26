package app

import (
	"context"
	"fmt"
	"net"
	"os"
	"path/filepath"
	"testing"
	"time"

	"code-code.internal/cli-output-sidecar/internal/parsers"
	runtimesidecarv1 "code-code.internal/go-contract/agent/runtime_sidecar/v1"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

func TestAppRunServesAccumulatorAndStop(t *testing.T) {
	if testing.Short() {
		t.Skip("integration test")
	}
	tempDir := t.TempDir()
	cfg := Config{
		AccumulatorPath: filepath.Join(tempDir, "state", "accumulator.json"),
		CLIID:           "gemini-cli",
		FIFOPath:        filepath.Join(tempDir, "raw", "events.fifo"),
		NATSURL:         "",
		ReadyPath:       filepath.Join(tempDir, "status", "ready"),
		RunID:           "run-1",
		SessionID:       "session-1",
		SocketPath:      filepath.Join("/tmp", fmt.Sprintf("cli-output-sidecar-%d.sock", time.Now().UnixNano())),
		StopPath:        filepath.Join(tempDir, "control", "stop.json"),
		TerminalPath:    filepath.Join(tempDir, "raw", "terminal.json"),
	}
	defer os.Remove(cfg.SocketPath)
	registry, err := parsers.NewBuiltinRegistry()
	if err != nil {
		t.Fatalf("NewBuiltinRegistry() error = %v", err)
	}
	app, err := New(cfg, registry)
	if err != nil {
		t.Fatalf("New() error = %v", err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	done := make(chan error, 1)
	go func() { done <- app.Run(ctx) }()

	waitForFile(t, cfg.ReadyPath)
	writeFIFO(t, cfg.FIFOPath, `{"type":"message","role":"assistant","content":"hello","delta":true}`+"\n")

	conn, err := grpc.NewClient("unix://"+cfg.SocketPath,
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithContextDialer(func(ctx context.Context, _ string) (net.Conn, error) {
			return (&net.Dialer{}).DialContext(ctx, "unix", cfg.SocketPath)
		}),
	)
	if err != nil {
		t.Fatalf("grpc.NewClient() error = %v", err)
	}
	defer conn.Close()
	client := runtimesidecarv1.NewCLIOutputSidecarServiceClient(conn)

	waitForAccumulator(t, client)
	response, err := client.GetAccumulator(context.Background(), &runtimesidecarv1.GetAccumulatorRequest{})
	if err != nil {
		t.Fatalf("GetAccumulator() error = %v", err)
	}
	if response.GetAssistantText() != "hello" {
		t.Fatalf("assistant_text = %q, want hello", response.GetAssistantText())
	}

	if _, err := client.Stop(context.Background(), &runtimesidecarv1.StopRequest{Force: true}); err != nil {
		t.Fatalf("Stop() error = %v", err)
	}
	waitForFile(t, cfg.StopPath)
	if err := os.WriteFile(cfg.TerminalPath, []byte(`{"exit_code":130}`), 0o644); err != nil {
		t.Fatalf("WriteFile(%s) error = %v", cfg.TerminalPath, err)
	}

	if err := <-done; err != nil {
		t.Fatalf("Run() error = %v", err)
	}
}

func TestAppRunRetriesPartialTerminalJSON(t *testing.T) {
	if testing.Short() {
		t.Skip("integration test")
	}
	tempDir := t.TempDir()
	cfg := Config{
		AccumulatorPath: filepath.Join(tempDir, "state", "accumulator.json"),
		CLIID:           "qwen-cli",
		FIFOPath:        filepath.Join(tempDir, "raw", "events.fifo"),
		NATSURL:         "",
		ReadyPath:       filepath.Join(tempDir, "status", "ready"),
		RunID:           "run-1",
		SessionID:       "session-1",
		SocketPath:      filepath.Join("/tmp", fmt.Sprintf("cli-output-sidecar-%d.sock", time.Now().UnixNano())),
		StopPath:        filepath.Join(tempDir, "control", "stop.json"),
		TerminalPath:    filepath.Join(tempDir, "raw", "terminal.json"),
	}
	defer os.Remove(cfg.SocketPath)
	registry, err := parsers.NewBuiltinRegistry()
	if err != nil {
		t.Fatalf("NewBuiltinRegistry() error = %v", err)
	}
	app, err := New(cfg, registry)
	if err != nil {
		t.Fatalf("New() error = %v", err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	done := make(chan error, 1)
	go func() { done <- app.Run(ctx) }()

	waitForFile(t, cfg.ReadyPath)
	if err := os.WriteFile(cfg.TerminalPath, []byte(`{"exit_code":`), 0o644); err != nil {
		t.Fatalf("WriteFile(%s) error = %v", cfg.TerminalPath, err)
	}
	time.Sleep(250 * time.Millisecond)
	select {
	case err := <-done:
		t.Fatalf("Run() returned early: %v", err)
	default:
	}
	if err := os.WriteFile(cfg.TerminalPath, []byte(`{"exit_code":0}`), 0o644); err != nil {
		t.Fatalf("WriteFile(%s) error = %v", cfg.TerminalPath, err)
	}
	if err := <-done; err != nil {
		t.Fatalf("Run() error = %v", err)
	}
}

func waitForFile(t *testing.T, path string) {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		if _, err := os.Stat(path); err == nil {
			return
		}
		time.Sleep(20 * time.Millisecond)
	}
	t.Fatalf("file %s was not created", path)
}

func writeFIFO(t *testing.T, path, body string) {
	t.Helper()
	file, err := os.OpenFile(path, os.O_WRONLY, 0)
	if err != nil {
		t.Fatalf("OpenFile(%s) error = %v", path, err)
	}
	defer file.Close()
	if _, err := file.WriteString(body); err != nil {
		t.Fatalf("WriteString() error = %v", err)
	}
}

func waitForAccumulator(t *testing.T, client runtimesidecarv1.CLIOutputSidecarServiceClient) {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		response, err := client.GetAccumulator(context.Background(), &runtimesidecarv1.GetAccumulatorRequest{})
		if err == nil && response.GetAssistantText() == "hello" {
			return
		}
		time.Sleep(20 * time.Millisecond)
	}
	t.Fatal("accumulator was not updated")
}
