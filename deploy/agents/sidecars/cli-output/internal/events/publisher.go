package events

import (
	"context"
	"fmt"
	"strings"
	"sync"

	"code-code.internal/cli-output-sidecar/internal/parser"
	outputv1 "code-code.internal/go-contract/agent/output/v1"
	resultv1 "code-code.internal/go-contract/agent/result/v1"
	"code-code.internal/go-contract/agui"
	runeventv1 "code-code.internal/go-contract/platform/run_event/v1"
	"github.com/nats-io/nats.go"
	"github.com/nats-io/nats.go/jetstream"
	"google.golang.org/protobuf/proto"
)

type Publisher interface {
	PublishOutputs(context.Context, []*outputv1.RunOutput) error
	PublishStatus(context.Context, runeventv1.RunStatusPhase, parser.Snapshot, string) error
	PublishTerminal(context.Context, *resultv1.RunResult, parser.Snapshot) error
	Close()
}

type Config struct {
	ClientName string
	NATSURL    string
	RunID      string
	SessionID  string
}

type JetStreamPublisher struct {
	clientName string
	url        string
	runID      string
	sessionID  string

	mu sync.Mutex
	nc *nats.Conn
	js jetstream.JetStream
}

func NewPublisher(config Config) (Publisher, error) {
	if strings.TrimSpace(config.NATSURL) == "" {
		return NoopPublisher{}, nil
	}
	if strings.TrimSpace(config.RunID) == "" || strings.TrimSpace(config.SessionID) == "" {
		return nil, fmt.Errorf("cli-output-sidecar/events: session_id and run_id are required when nats is enabled")
	}
	return &JetStreamPublisher{
		clientName: strings.TrimSpace(config.ClientName),
		url:        strings.TrimSpace(config.NATSURL),
		runID:      strings.TrimSpace(config.RunID),
		sessionID:  strings.TrimSpace(config.SessionID),
	}, nil
}

func (p *JetStreamPublisher) PublishOutputs(ctx context.Context, outputs []*outputv1.RunOutput) error {
	for _, output := range outputs {
		if output == nil {
			continue
		}
		if isDelta(output) {
			if err := p.publish(ctx, deltaSubject(p.sessionID, p.runID), &runeventv1.RunDeltaEvent{
				SessionId: p.sessionID,
				RunId:     p.runID,
				Output:    output,
			}); err != nil {
				return err
			}
			continue
		}
		if err := p.publish(ctx, resultSubject(p.sessionID, p.runID), &runeventv1.RunResultEvent{
			SessionId: p.sessionID,
			RunId:     p.runID,
			Payload:   &runeventv1.RunResultEvent_Output{Output: output},
		}); err != nil {
			return err
		}
	}
	return nil
}

func (p *JetStreamPublisher) PublishStatus(ctx context.Context, phase runeventv1.RunStatusPhase, snapshot parser.Snapshot, message string) error {
	return p.publish(ctx, statusSubject(p.sessionID, p.runID), &runeventv1.RunStatusEvent{
		SessionId:    p.sessionID,
		RunId:        p.runID,
		Phase:        phase,
		LastSequence: snapshot.LastSequence,
		Message:      message,
	})
}

func (p *JetStreamPublisher) PublishTerminal(ctx context.Context, result *resultv1.RunResult, _ parser.Snapshot) error {
	return p.publish(ctx, resultSubject(p.sessionID, p.runID), &runeventv1.RunResultEvent{
		SessionId: p.sessionID,
		RunId:     p.runID,
		Payload:   &runeventv1.RunResultEvent_TerminalResult{TerminalResult: result},
	})
}

func (p *JetStreamPublisher) Close() {
	if p == nil {
		return
	}
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.nc != nil {
		p.nc.Close()
		p.nc = nil
		p.js = nil
	}
}

func (p *JetStreamPublisher) publish(ctx context.Context, subject string, message proto.Message) error {
	js, err := p.jetStream(ctx)
	if err != nil {
		return err
	}
	body, err := proto.Marshal(message)
	if err != nil {
		return fmt.Errorf("cli-output-sidecar/events: marshal %T: %w", message, err)
	}
	if _, err := js.Publish(ctx, subject, body); err != nil {
		return fmt.Errorf("cli-output-sidecar/events: publish %q: %w", subject, err)
	}
	return nil
}

func (p *JetStreamPublisher) jetStream(ctx context.Context) (jetstream.JetStream, error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.js != nil {
		return p.js, nil
	}
	options := []nats.Option{}
	if p.clientName != "" {
		options = append(options, nats.Name(p.clientName))
	}
	nc, err := nats.Connect(p.url, options...)
	if err != nil {
		return nil, fmt.Errorf("cli-output-sidecar/events: connect: %w", err)
	}
	js, err := jetstream.New(nc)
	if err != nil {
		nc.Close()
		return nil, fmt.Errorf("cli-output-sidecar/events: create jetstream client: %w", err)
	}
	if err := ensureStreams(ctx, js); err != nil {
		nc.Close()
		return nil, err
	}
	p.nc = nc
	p.js = js
	return p.js, nil
}

type NoopPublisher struct{}

func (NoopPublisher) PublishOutputs(context.Context, []*outputv1.RunOutput) error { return nil }
func (NoopPublisher) PublishStatus(context.Context, runeventv1.RunStatusPhase, parser.Snapshot, string) error {
	return nil
}
func (NoopPublisher) PublishTerminal(context.Context, *resultv1.RunResult, parser.Snapshot) error {
	return nil
}
func (NoopPublisher) Close() {}

func isDelta(output *outputv1.RunOutput) bool {
	return agui.IsRealtimeOutput(output)
}
