package app

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

const (
	defaultAccumulatorPath = "/run/cli-output/state/accumulator.json"
	defaultFIFOPath        = "/run/cli-output/raw/events.fifo"
	defaultNATSURL         = ""
	defaultReadyPath       = "/run/cli-output/status/ready"
	defaultSocketPath      = "/run/cli-output/grpc/sidecar.sock"
	defaultStopPath        = "/run/cli-output/control/stop.json"
	defaultTerminalPath    = "/run/cli-output/raw/terminal.json"
	sharedDirMode          = 0o770
)

type Config struct {
	AccumulatorPath string
	CLIID           string
	FIFOPath        string
	NATSURL         string
	ReadyPath       string
	RunID           string
	SessionID       string
	SocketPath      string
	StopPath        string
	TerminalPath    string
}

func LoadConfigFromEnv() (Config, error) {
	cfg := Config{
		AccumulatorPath: defaultPath("CLI_OUTPUT_ACCUMULATOR_PATH", defaultAccumulatorPath),
		CLIID:           strings.TrimSpace(os.Getenv("CLI_OUTPUT_CLI_ID")),
		FIFOPath:        defaultPath("CLI_OUTPUT_FIFO_PATH", defaultFIFOPath),
		NATSURL:         defaultPath("CLI_OUTPUT_NATS_URL", defaultNATSURL),
		ReadyPath:       defaultPath("CLI_OUTPUT_READY_PATH", defaultReadyPath),
		RunID:           strings.TrimSpace(os.Getenv("CLI_OUTPUT_RUN_ID")),
		SessionID:       strings.TrimSpace(os.Getenv("CLI_OUTPUT_SESSION_ID")),
		SocketPath:      defaultPath("CLI_OUTPUT_SOCKET_PATH", defaultSocketPath),
		StopPath:        defaultPath("CLI_OUTPUT_STOP_PATH", defaultStopPath),
		TerminalPath:    defaultPath("CLI_OUTPUT_TERMINAL_PATH", defaultTerminalPath),
	}
	if cfg.CLIID == "" {
		return Config{}, fmt.Errorf("cli-output-sidecar: CLI_OUTPUT_CLI_ID is required")
	}
	return cfg, nil
}

func defaultPath(key, fallback string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value != "" {
		return value
	}
	return fallback
}

func (c Config) ensureDirs() error {
	for _, path := range []string{c.AccumulatorPath, c.FIFOPath, c.ReadyPath, c.SocketPath, c.StopPath, c.TerminalPath} {
		if err := os.MkdirAll(filepath.Dir(path), sharedDirMode); err != nil {
			return err
		}
	}
	return nil
}
