package wecomcallback

import (
	"context"
	"fmt"
	"time"

	notificationv1 "code-code.internal/go-contract/platform/notification/v1"
	"github.com/nats-io/nats.go"
	"google.golang.org/protobuf/proto"
)

const natsPublishFlushTimeout = 500 * time.Millisecond

// NATSPublisher publishes inbound callback events to one NATS subject.
type NATSPublisher struct {
	conn    *nats.Conn
	subject string
}

// NewNATSPublisher connects a callback event publisher to NATS.
func NewNATSPublisher(url string, subject string) (*NATSPublisher, error) {
	if url == "" {
		return nil, fmt.Errorf("wecomcallback: nats url is required")
	}
	if subject == "" {
		return nil, fmt.Errorf("wecomcallback: nats subject is required")
	}
	conn, err := nats.Connect(url, nats.Name("wecom-callback-adapter"))
	if err != nil {
		return nil, fmt.Errorf("wecomcallback: connect nats: %w", err)
	}
	return &NATSPublisher{conn: conn, subject: subject}, nil
}

func (p *NATSPublisher) Publish(ctx context.Context, event *notificationv1.InboundMessageEvent) error {
	if event == nil {
		return fmt.Errorf("wecomcallback: event is nil")
	}
	if ctx == nil {
		ctx = context.Background()
	}
	data, err := proto.MarshalOptions{Deterministic: true}.Marshal(event)
	if err != nil {
		return fmt.Errorf("wecomcallback: encode event: %w", err)
	}
	if err := p.conn.Publish(p.subject, data); err != nil {
		return fmt.Errorf("wecomcallback: publish event: %w", err)
	}
	flushCtx, cancel := context.WithTimeout(ctx, natsPublishFlushTimeout)
	defer cancel()
	if err := p.conn.FlushWithContext(flushCtx); err != nil {
		return fmt.Errorf("wecomcallback: flush event: %w", err)
	}
	return nil
}

// Close drains the publisher connection.
func (p *NATSPublisher) Close() {
	if p == nil || p.conn == nil {
		return
	}
	_ = p.conn.Drain()
}
