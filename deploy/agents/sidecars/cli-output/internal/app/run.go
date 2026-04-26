package app

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net"
	"os"
	"time"

	"code-code.internal/cli-output-sidecar/internal/events"
	"code-code.internal/cli-output-sidecar/internal/parser"
	runtimesidecarv1 "code-code.internal/go-contract/agent/runtime_sidecar/v1"
	runeventv1 "code-code.internal/go-contract/platform/run_event/v1"
	"google.golang.org/grpc"
)

type App struct {
	cfg       Config
	listener  net.Listener
	publisher events.Publisher
	registry  *parser.Registry
	server    *grpc.Server
	state     *State
}

func New(cfg Config, registry *parser.Registry) (*App, error) {
	if err := cfg.ensureDirs(); err != nil {
		return nil, err
	}
	if err := ensureFIFO(cfg.FIFOPath); err != nil {
		return nil, err
	}
	if err := os.RemoveAll(cfg.SocketPath); err != nil {
		return nil, err
	}
	if err := os.RemoveAll(cfg.ReadyPath); err != nil {
		return nil, err
	}
	if err := os.RemoveAll(cfg.StopPath); err != nil {
		return nil, err
	}
	parserInstance, err := registry.New(cfg.CLIID)
	if err != nil {
		return nil, err
	}
	publisher, err := events.NewPublisher(events.Config{
		ClientName: "cli-output-sidecar",
		NATSURL:    cfg.NATSURL,
		RunID:      cfg.RunID,
		SessionID:  cfg.SessionID,
	})
	if err != nil {
		return nil, err
	}
	state := NewState(parserInstance, cfg.AccumulatorPath, cfg.StopPath)
	if err := writeJSONFile(cfg.AccumulatorPath, parser.Snapshot{}); err != nil {
		return nil, err
	}
	listener, err := net.Listen("unix", cfg.SocketPath)
	if err != nil {
		return nil, err
	}
	server := grpc.NewServer()
	runtimesidecarv1.RegisterCLIOutputSidecarServiceServer(server, NewService(state, publisher))
	return &App{cfg: cfg, listener: listener, publisher: publisher, registry: registry, server: server, state: state}, nil
}

func (a *App) Run(ctx context.Context) error {
	grpcErrCh := make(chan error, 1)
	fifoErrCh := make(chan error, 1)
	terminalErrCh := make(chan error, 1)
	if err := a.publisher.PublishStatus(ctx, runeventv1.RunStatusPhase_RUN_STATUS_PHASE_STARTING, parser.Snapshot{}, "starting"); err != nil {
		return err
	}
	go func() { grpcErrCh <- a.server.Serve(a.listener) }()
	go func() { fifoErrCh <- a.consumeFIFO() }()
	go func() { terminalErrCh <- a.watchTerminal(ctx) }()
	if err := writeFile(a.cfg.ReadyPath, []byte("ready\n")); err != nil {
		return err
	}
	if err := a.publisher.PublishStatus(ctx, runeventv1.RunStatusPhase_RUN_STATUS_PHASE_PARSER_READY, parser.Snapshot{}, "parser ready"); err != nil {
		return err
	}
	select {
	case <-ctx.Done():
		return a.shutdown()
	case err := <-grpcErrCh:
		if err != nil {
			return err
		}
		return nil
	case err := <-fifoErrCh:
		if err != nil {
			return err
		}
		return nil
	case err := <-terminalErrCh:
		if err != nil {
			return err
		}
		return a.shutdown()
	}
}

func (a *App) consumeFIFO() error {
	file, err := os.OpenFile(a.cfg.FIFOPath, os.O_RDWR, 0)
	if err != nil {
		return err
	}
	defer file.Close()
	scanner := bufio.NewScanner(file)
	buffer := make([]byte, 0, 64*1024)
	scanner.Buffer(buffer, 1024*1024)
	runningPublished := false
	for scanner.Scan() {
		outputs, err := a.state.ParseLine(scanner.Bytes(), time.Now())
		if err != nil {
			return err
		}
		if len(outputs) == 0 {
			continue
		}
		snapshot, err := a.state.Snapshot()
		if err != nil {
			return err
		}
		if !runningPublished {
			if err := a.publisher.PublishStatus(context.Background(), runeventv1.RunStatusPhase_RUN_STATUS_PHASE_RUNNING, snapshot, "running"); err != nil {
				return err
			}
			runningPublished = true
		}
		if err := a.publisher.PublishOutputs(context.Background(), outputs); err != nil {
			return err
		}
	}
	return scanner.Err()
}

func (a *App) watchTerminal(ctx context.Context) error {
	ticker := time.NewTicker(100 * time.Millisecond)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return nil
		case <-ticker.C:
			if _, err := os.Stat(a.cfg.TerminalPath); err != nil {
				if os.IsNotExist(err) {
					continue
				}
				return err
			}
			snapshot, err := a.state.Flush(time.Now())
			if err != nil {
				return err
			}
			result, phase, err := events.ResultFromTerminal(a.cfg.TerminalPath, a.cfg.StopPath)
			if err != nil {
				if retryableTerminalResultError(err) {
					continue
				}
				return err
			}
			if err := a.publisher.PublishTerminal(ctx, result, snapshot); err != nil {
				return err
			}
			if err := a.publisher.PublishStatus(ctx, phase, snapshot, "terminal"); err != nil {
				return err
			}
			return nil
		}
	}
}

func (a *App) shutdown() error {
	a.publisher.Close()
	a.server.GracefulStop()
	if err := a.listener.Close(); err != nil && !errors.Is(err, net.ErrClosed) {
		return err
	}
	_ = os.Remove(a.cfg.ReadyPath)
	return nil
}

func retryableTerminalResultError(err error) bool {
	if err == nil {
		return false
	}
	var syntaxErr *json.SyntaxError
	return errors.As(err, &syntaxErr) || errors.Is(err, io.EOF) || errors.Is(err, io.ErrUnexpectedEOF)
}
